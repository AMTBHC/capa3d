/// <reference lib="webworker" />
import { analyzeMesh } from "./analyze";

self.onmessage = (e: MessageEvent<Float32Array>) => {
  try {
    self.postMessage({ ok: true, result: analyzeMesh(e.data) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
