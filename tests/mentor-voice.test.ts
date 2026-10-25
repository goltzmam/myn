// @vitest-environment jsdom
import { act, renderHook, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { useMentorVoice } from "../hooks/use-mentor-voice";
let track: { stop: ReturnType<typeof vi.fn> };
let recorder: FakeRecorder;
let close: ReturnType<typeof vi.fn>;
class FakeRecorder {
  static isTypeSupported() {
    return true;
  }
  mimeType = "audio/webm";
  state = "inactive";
  ondataavailable: any;
  onstop: any;
  onerror: any;
  constructor() {
    recorder = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["recorded voice"], { type: "audio/webm" }),
    });
    void this.onstop?.();
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  track = { stop: vi.fn() };
  close = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal(
    "AudioContext",
    class {
      resume = vi.fn().mockResolvedValue(undefined);
      close = close;
      createMediaStreamSource() {
        return { connect() {} };
      }
      createAnalyser() {
        return {
          fftSize: 1024,
          getByteTimeDomainData: (v: Uint8Array) => v.fill(128),
        };
      }
    },
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }),
    },
  });
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("waits until the complete answer has played before listening again", async () => {
  let finish!: () => void;
  const answer = new Promise<void>((r) => (finish = r)),
    onUtterance = vi.fn(() => answer),
    onError = vi.fn();
  const { result } = renderHook(() => useMentorVoice({ onUtterance, onError }));
  await act(async () => {
    await result.current.start(true);
  });
  expect(result.current.listening).toBe(true);
  await act(async () => result.current.finish());
  expect(onUtterance).toHaveBeenCalledOnce();
  expect(result.current.listening).toBe(false);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(result.current.listening).toBe(false);
  await act(async () => {
    finish();
    await answer;
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(result.current.listening).toBe(true);
  act(() => result.current.stop());
  expect(track.stop).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
});
it("stopping discards the current microphone chunk and never uploads it", async () => {
  const onUtterance = vi.fn(),
    onError = vi.fn();
  const { result } = renderHook(() => useMentorVoice({ onUtterance, onError }));
  await act(async () => {
    await result.current.start();
  });
  act(() => result.current.stop());
  expect(onUtterance).not.toHaveBeenCalled();
  expect(result.current.active).toBe(false);
  expect(track.stop).toHaveBeenCalledOnce();
});
it("one-question mode releases the microphone after the answer", async () => {
  const onUtterance = vi.fn().mockResolvedValue(undefined),
    onError = vi.fn();
  const { result } = renderHook(() => useMentorVoice({ onUtterance, onError }));
  await act(async () => {
    await result.current.start(false);
  });
  await act(async () => result.current.finish());
  expect(onUtterance).toHaveBeenCalledOnce();
  expect(result.current.active).toBe(false);
  expect(track.stop).toHaveBeenCalledOnce();
});
it("releases devices if transcription or inference fails", async () => {
  const problem = new Error("provider failure"),
    onUtterance = vi.fn().mockRejectedValue(problem),
    onError = vi.fn();
  const { result } = renderHook(() => useMentorVoice({ onUtterance, onError }));
  await act(async () => {
    await result.current.start();
  });
  await act(async () => result.current.finish());
  expect(onError).toHaveBeenCalledWith(problem);
  expect(result.current.active).toBe(false);
  expect(track.stop).toHaveBeenCalledOnce();
});
it("does not start recording until the generated introduction has finished playing", async () => {
  let release!: () => void;
  const greeting = new Promise<void>((r) => (release = r)),
    onUtterance = vi.fn(),
    onError = vi.fn();
  const { result } = renderHook(() => useMentorVoice({ onUtterance, onError }));
  let opening!: Promise<void>;
  act(() => {
    opening = result.current.start(true, () => greeting);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(result.current.active).toBe(true);
  expect(result.current.listening).toBe(false);
  await act(async () => {
    release();
    await opening;
  });
  expect(result.current.listening).toBe(true);
  expect(onUtterance).not.toHaveBeenCalled();
});
it("explains denied microphone permission instead of silently staying idle", async () => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
    },
  });
  const onError = vi.fn();
  const { result } = renderHook(() =>
    useMentorVoice({ onUtterance: vi.fn(), onError }),
  );
  await act(async () => result.current.start());
  expect(result.current.active).toBe(false);
  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({ code: "MICROPHONE_UNAVAILABLE" }),
  );
});
