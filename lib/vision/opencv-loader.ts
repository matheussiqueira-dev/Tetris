let openCvPromise: Promise<unknown> | null = null;

const SCRIPT_ID = "opencv-js-runtime";
const OPENCV_URL = "https://docs.opencv.org/4.x/opencv.js";

type OpenCvLike = {
  Mat?: unknown;
  onRuntimeInitialized?: () => void;
  [key: string]: unknown;
};

function isReady(cv: OpenCvLike | undefined): cv is OpenCvLike & { Mat: unknown } {
  return Boolean(cv && cv.Mat);
}

export function loadOpenCv(): Promise<unknown> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV.js precisa rodar no browser."));
  }

  const initialCv = window.cv as OpenCvLike | undefined;
  if (isReady(initialCv)) {
    return Promise.resolve(initialCv);
  }

  if (openCvPromise) {
    return openCvPromise;
  }

  openCvPromise = new Promise((resolve, reject) => {
    const handleLoaded = () => {
      const runtime = window.cv as OpenCvLike | undefined;
      if (!runtime) {
        reject(new Error("OpenCV.js foi carregado, mas o objeto cv nao foi encontrado."));
        return;
      }

      if (isReady(runtime)) {
        resolve(runtime);
        return;
      }

      runtime.onRuntimeInitialized = () => resolve(runtime);
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        handleLoaded();
      } else {
        existing.addEventListener("load", handleLoaded, { once: true });
        existing.addEventListener("error", () => reject(new Error("Falha ao carregar OpenCV.js.")), {
          once: true
        });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = OPENCV_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      handleLoaded();
    });
    script.addEventListener(
      "error",
      () => {
        reject(new Error("Falha ao baixar OpenCV.js."));
      },
      { once: true }
    );
    document.body.appendChild(script);
  });

  return openCvPromise;
}
