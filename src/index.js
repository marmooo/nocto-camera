import {
  Offcanvas,
  Popover,
  Tooltip,
} from "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/+esm";
import glfx from "https://cdn.jsdelivr.net/npm/glfx@0.0.4/+esm";

function loadConfig() {
  configPanel.serverAddress.value = localStorage.getItem("serverAddress");
  if (localStorage.getItem("darkMode") == 1) {
    document.documentElement.setAttribute("data-bs-theme", "dark");
  }
}

function toggleDarkMode() {
  if (localStorage.getItem("darkMode") == 1) {
    localStorage.setItem("darkMode", 0);
    document.documentElement.setAttribute("data-bs-theme", "light");
  } else {
    localStorage.setItem("darkMode", 1);
    document.documentElement.setAttribute("data-bs-theme", "dark");
  }
}

function initLangSelect() {
  const langSelect = document.getElementById("lang");
  langSelect.onchange = () => {
    const lang = langSelect.options[langSelect.selectedIndex].value;
    location.href = `/nocto-camera/${lang}/`;
  };
}

function initTooltip() {
  for (const node of document.querySelectorAll('[data-bs-toggle="tooltip"]')) {
    const tooltip = new Tooltip(node);
    node.addEventListener("touchstart", () => tooltip.show());
    node.addEventListener("touchend", () => tooltip.hide());
    node.addEventListener("click", () => {
      if (!tooltip.tip) return;
      tooltip.tip.classList.add("d-none");
      tooltip.hide();
      tooltip.tip.classList.remove("d-none");
    });
  }
}

async function getOpenCVPath() {
  // const simdSupport = await wasmFeatureDetect.simd();
  // const threadsSupport = self.crossOriginIsolated &&
  //   await wasmFeatureDetect.threads();
  // if (simdSupport && threadsSupport) {
  //   return "/nocto-camera/opencv/threaded-simd/opencv_js.js";
  // } else if (simdSupport) {
  //   return "/nocto-camera/opencv/simd/opencv_js.js";
  // } else if (threadsSupport) {
  //   return "/nocto-camera/opencv/threads/opencv_js.js";
  // } else {
  //   return "/nocto-camera/opencv/wasm/opencv_js.js";
  // }
  return "/nocto-camera/opencv/wasm/opencv_js.js";
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    script.src = url;
    document.body.appendChild(script);
  });
}

class ImageBox extends HTMLElement {
  constructor() {
    super();
    const template = document.getElementById("img-box")
      .content.cloneNode(true);
    template.querySelector("img").onclick = (event) => {
      loadPanel.hide();
      cameraPanel.hide();
      filterPanel.setCanvas(event.target);
      filterPanel.show();
    };
    template.querySelector(".delete").onclick = () => this.remove();
    this.attachShadow({ mode: "open" }).appendChild(template);
  }
}
customElements.define("img-box", ImageBox);

class Panel {
  constructor(panel) {
    this.panel = panel;
  }

  show() {
    this.panel.classList.remove("d-none");
  }

  hide() {
    this.panel.classList.add("d-none");
  }

  getActualRect(canvas) {
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;
    const naturalWidth = canvas.width;
    const naturalHeight = canvas.height;
    const aspectRatio = naturalWidth / naturalHeight;
    let width, height, top, left, right, bottom;
    if (canvasWidth / canvasHeight > aspectRatio) {
      width = canvasHeight * aspectRatio;
      height = canvasHeight;
      top = 0;
      left = (canvasWidth - width) / 2;
      right = left + width;
      bottom = canvasHeight;
    } else {
      width = canvasWidth;
      height = canvasWidth / aspectRatio;
      top = (canvasHeight - height) / 2;
      left = 0;
      right = canvasWidth;
      bottom = top + height;
    }
    return { width, height, top, left, right, bottom };
  }
}

class LoadPanel extends Panel {
  constructor(panel) {
    super(panel);

    panel.querySelector(".clipboard").onclick = (event) => {
      this.loadClipboardImage(event);
    };
    panel.querySelector(".selectImage").onclick = () => {
      panel.querySelector(".inputImage").click();
    };
    panel.querySelector(".executeCamera").onclick = () => this.executeCamera();
    panel.querySelector(".inputImage").onchange = (event) => {
      this.loadInputImage(event);
    };
    document.body.onpaste = (event) => {
      if (!this.panel.classList.contains("d-none")) {
        this.loadClipboardImage(event);
      }
    };
  }

  show() {
    super.show();
    document.body.scrollIntoView({ behavior: "instant" });
  }

  executeCamera() {
    this.hide();
    cameraPanel.show();
    cameraPanel.executeVideo();
  }

  handleImageOnloadEvent = (event) => {
    const img = event.currentTarget;
    filterPanel.setCanvas(img);
  };

  loadImage(url) {
    loadPanel.hide();
    filterPanel.show();
    const img = new Image();
    img.onload = (event) => this.handleImageOnloadEvent(event);
    img.src = url;
  }

  loadInputImage(event) {
    const file = event.currentTarget.files[0];
    this.loadFile(file);
    event.currentTarget.value = "";
  }

  loadFile(file) {
    if (!file.type.startsWith("image/")) return;
    if (file.type === "image/svg+xml") {
      alert("SVG is not supported.");
      return;
    }
    const url = URL.createObjectURL(file);
    this.loadImage(url);
  }

  async loadClipboardImage() {
    try {
      const items = await navigator.clipboard.read();
      const item = items[0];
      for (const type of item.types) {
        if (type === "image/svg+xml") {
          alert("SVG is not supported.");
        } else if (type.startsWith("image/")) {
          const file = await item.getType(type);
          const url = URL.createObjectURL(file);
          this.loadImage(url);
          break;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
}

class CameraPanel extends Panel {
  stream;
  animationFrame;
  defaultWidth;
  defaultHeight;
  lastAnimated = 0;

  constructor(panel) {
    super(panel);
    this.panelContainer = panel.querySelector(".panelContainer");
    const video = document.createElement("video");
    video.addEventListener("play", () => {
      this.loadingMessage.classList.add("d-none");
    });
    this.video = video;
    this.videoOptions = {
      audio: false,
      video: { facingMode: "environment" },
    };
    this.canvas = panel.querySelector("canvas");
    this.canvasContext = this.canvas.getContext("2d", {
      willReadFrequently: true,
    });
    this.canvasContainer = this.canvas.parentNode;
    this.loadingMessage = panel.querySelector(".loadingMessage");
    panel.querySelector(".moveTop").onclick = () => this.moveLoadPanel();
    panel.querySelector(".toggleFacingMode").onclick = () =>
      this.toggleFacingMode();
    panel.querySelector(".snapshot").onclick = () => this.snapshot();
    const resolution = panel.querySelector(".resolution");
    const resolutionRange = document.createElement("input");
    resolutionRange.type = "range";
    resolutionRange.min = 1;
    resolutionRange.max = 10;
    resolutionRange.value = 5;
    resolutionRange.dataset.value = 5;
    resolutionRange.className = "resolutionRange form-range";
    resolutionRange.onchange = async () => {
      if (!this.stream) return;
      this.setResolution();
      await this.initVideo();
    };
    this.resolutionRange = resolutionRange;
    this.resolutionPopover = new Popover(resolution, {
      trigger: "click",
      placement: "top",
      html: true,
      content: resolutionRange,
      customClass: "resolutionPopover",
    });
    this.addFilterEvents(panel);
  }

  addFilterEvents(panel) {
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvasContext = this.offscreenCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    this.clipLimitRange = panel.querySelector(".clipLimitRange");
    this.tileGridSizeRange = panel.querySelector(".tileGridSizeRange");
    this.gammaRange = panel.querySelector(".gammaRange");
    this.equalizedHistSwitch = panel.querySelector(".equalizedHistSwitch");

    this.gammaRange.oninput = () => this.setLUT();
    this.gammaRange.onchange = () => this.setLUT();

    panel.querySelector(".clipLimitReset").onclick = () => {
      this.clipLimitRange.value = this.clipLimitRange.dataset.value;
    };
    panel.querySelector(".tileGridSizeReset").onclick = () => {
      this.tileGridSizeRange.value = this.tileGridSizeRange.dataset.value;
    };
    panel.querySelector(".gammaReset").onclick = () => {
      this.gammaRange.value = this.gammaRange.dataset.value;
    };
  }

  drawOffscreenCanvas(image, width, height) {
    const canvas = this.offscreenCanvas;
    canvas.width = width;
    canvas.height = height;
    this.offscreenCanvasContext.drawImage(
      image,
      0,
      0,
      width,
      height,
    );
  }

  setLUT() {
    const gamma = Number(this.gammaRange.value);
    const gammaValue = 2 ** gamma;
    const gammaArray = new Array(256);
    for (let i = 0; i < gammaArray.length; i++) {
      gammaArray[i] = (i / 255) ** gammaValue * 255;
    }
    this.lut = cv.matFromArray(1, 256, cv.CV_8U, gammaArray);
  }

  clahe() {
    const clipLimit = Number(this.clipLimitRange.value);
    const tileGridSize = Number(this.tileGridSizeRange.value);
    const gamma = Number(this.gammaRange.value);
    const equalizedHist = Number(this.equalizedHistSwitch.checked);
    if (!equalizedHist && tileGridSize === 0 && gamma === 0) {
      this.canvasContext.drawImage(this.offscreenCanvas, 0, 0);
      return;
    }
    const src = cv.imread(this.offscreenCanvas);
    if (gamma !== 0) cv.LUT(src, this.lut, src);

    cv.cvtColor(src, src, cv.COLOR_BGR2Lab, 0);
    const size = new cv.Size(tileGridSize, tileGridSize);
    const clahe = new cv.CLAHE(clipLimit, size);
    const labPlanes = new cv.MatVector();
    cv.split(src, labPlanes);
    const mat = labPlanes.get(0);
    if (equalizedHist) cv.equalizeHist(mat, mat);
    if (tileGridSize !== 0) clahe.apply(mat, mat);
    cv.merge(labPlanes, src);
    cv.cvtColor(src, src, cv.COLOR_Lab2BGR, 0);
    cv.imshow(this.canvas, src);
    src.delete();
    labPlanes.delete();
    mat.delete();
    clahe.delete();
  }

  show() {
    super.show();
    this.panelContainer.scrollIntoView({ behavior: "instant" });
  }

  hideResolutionPopover() {
    const popover = this.resolutionPopover;
    if (popover.tip) {
      popover.tip.classList.add("d-none");
      popover.hide();
      popover.tip.classList.remove("d-none");
    }
  }

  moveLoadPanel() {
    this.hideResolutionPopover();
    this.stopCamera();
    this.hide();
    loadPanel.show();
  }

  setResolution() {
    const [width, height] = this.getIdealResolution();
    const aspectRatio = width / height;
    const videoOptions = this.videoOptions.video;
    videoOptions.width = { ideal: width };
    videoOptions.height = { ideal: height };
    videoOptions.aspectRatio = { exact: aspectRatio };
  }

  getIdealResolution() {
    const value = Number(this.resolutionRange.value);
    const defaultValue = Number(this.resolutionRange.dataset.value);
    const factor = Math.sqrt(2) ** (value - defaultValue);
    return [this.defaultWidth * factor, this.defaultHeight * factor];
  }

  toggleFacingMode() {
    this.hideResolutionPopover();
    const video = this.videoOptions.video;
    if (video.facingMode == "user") {
      video.facingMode = "environment";
    } else {
      video.facingMode = "user";
    }
    this.executeVideo();
  }

  stopCamera() {
    if (!this.stream) return;
    this.stream.getVideoTracks().forEach((track) => {
      track.stop();
    });
    this.stream = null;
  }

  initVideoOptions(settings) {
    const { width, height, aspectRatio } = settings;
    const videoOptions = this.videoOptions.video;
    const isPortrait = globalThis.innerHeight > globalThis.innerWidth;
    const isIOS = CSS.supports("-webkit-touch-callout: default");
    const [idealWidth, idealHeight, exactAspectRatio] = isPortrait && !isIOS
      ? [height, width, 1 / aspectRatio]
      : [width, height, aspectRatio];
    videoOptions.width = { ideal: idealWidth };
    videoOptions.height = { ideal: idealHeight };
    videoOptions.aspectRatio = { exact: exactAspectRatio };
    if (!this.defaultWidth) {
      this.defaultWidth = width;
      this.defaultHeight = height;
    }
    this.canvas.width = idealWidth;
    this.canvas.height = idealHeight;
    this.offscreenCanvas.width = idealWidth;
    this.offscreenCanvas.height = idealHeight;
  }

  async initVideo() {
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia(
        this.videoOptions,
      );
    }
    const track = this.stream.getVideoTracks()[0];
    await track.applyConstraints(this.videoOptions.video);
    const settings = track.getSettings();
    this.initVideoOptions(settings);
    await track.applyConstraints(this.videoOptions.video);
  }

  async executeVideo() {
    this.stopCamera();
    this.loadingMessage.classList.remove("d-none");
    await this.initVideo();
    const video = this.video;
    video.srcObject = this.stream;
    // https://qiita.com/tinymouse/items/8b82f3578e167627d209
    // https://stackoverflow.com/questions/53483975/
    video.autoPlay = true;
    video.muted = true;
    video.playsInline = true;
    video.play();
    this.animationFrame = requestAnimationFrame(this.tickVideo);
  }

  tickVideo = () => {
    const fps = 30;
    const t = Date.now();
    if (this.lastAnimated + 1000 / fps < t) {
      this.lastAnimated = t;
      const video = this.video;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // this.canvasContext.drawImage(video, 0, 0);
        this.offscreenCanvasContext.drawImage(video, 0, 0);
        this.clahe();
      }
    }
    this.animationFrame = requestAnimationFrame(this.tickVideo);
  };

  snapshot() {
    this.hideResolutionPopover();
    if (!this.stream) return;
    new Audio("/nocto-camera/camera.mp3").play();
    thumbnailPanel.add(this.canvas);
  }
}

class ThumbnailPanel extends Panel {
  constructor(panel) {
    super(panel);
    this.gallery = panel.querySelector(".gallery");
    panel.querySelector(".deleteAll").onclick = () => this.deleteAll();
    panel.querySelector(".download").onclick = () => this.download();
    panel.querySelector(".uploadServer").onclick = () => {
      configPanel.uploadServer();
    };
    panel.querySelector(".showConfig").onclick = () => {
      configPanel.offcanvas.show();
    };
  }

  add(canvas) {
    const thumbnail = document.createElement("img-box");
    const img = thumbnail.shadowRoot.querySelector("img");
    img.src = canvas.toDataURL("image/jpeg");
    img.width = 150;
    img.height = 150 / canvas.width * canvas.height;
    this.gallery.append(thumbnail);
  }

  deleteAll() {
    while (this.gallery.firstChild) {
      this.gallery.removeChild(this.gallery.lastChild);
    }
  }

  download() {
    const gallery = this.gallery;
    for (let i = 0; i < gallery.children.length; i++) {
      const a = document.createElement("a");
      a.download = i + ".jpg";
      a.href = gallery.children[i].shadowRoot.querySelector("img").src;
      gallery.appendChild(a);
      a.click();
      gallery.removeChild(a);
    }
  }
}

class FilterPanel extends Panel {
  constructor(panel) {
    super(panel);
    this.panelContainer = panel.querySelector(".panelContainer");
    this.selectedIndex = 0;
    this.glfxCanvas = glfx.canvas();
    this.canvas = panel.querySelector("canvas");
    this.canvasContext = this.canvas.getContext("2d", {
      willReadFrequently: true,
    });
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvasContext = this.offscreenCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    this.canvasContainer = this.canvas.parentNode;

    panel.querySelector(".moveTop").onclick = () => this.moveLoadPanel();
    panel.querySelector(".executeCamera").onclick = () => this.executeCamera();
    panel.querySelector(".filterSelect").onchange = (event) =>
      this.filterSelect(event);
    panel.querySelector(".rotate").onclick = () => this.rotate();
    panel.querySelector(".saveToAlbum").onclick = () => this.saveToAlbum();
    this.addGlfxEvents(panel);
    this.addAspectRatioEvents(panel);
  }

  show() {
    super.show();
    this.panelContainer.scrollIntoView({ behavior: "instant" });
  }

  moveLoadPanel() {
    this.hide();
    loadPanel.show();
  }

  executeCamera() {
    this.hide();
    cameraPanel.show();
    cameraPanel.executeVideo();
  }

  filterSelect(event) {
    this.texture.loadContentsOf(this.glfxCanvas.update());
    const options = event.target.options;
    const selectedIndex = options.selectedIndex;
    const prevClass = options[this.selectedIndex].value;
    const currClass = options[selectedIndex].value;
    this.panel.querySelector(`.${prevClass}`).classList.add("d-none");
    this.panel.querySelector(`.${currClass}`).classList.remove("d-none");
    this.selectedIndex = selectedIndex;
  }

  setLUT() {
    const gamma = Number(this.gammaRange.value);
    const gammaValue = 2 ** gamma;
    const gammaArray = new Array(256);
    for (let i = 0; i < gammaArray.length; i++) {
      gammaArray[i] = (i / 255) ** gammaValue * 255;
    }
    this.lut = cv.matFromArray(1, 256, cv.CV_8U, gammaArray);
  }

  clahe() {
    const clipLimit = Number(this.clipLimitRange.value);
    const tileGridSize = Number(this.tileGridSizeRange.value);
    const gamma = Number(this.gammaRange.value);
    const equalizedHist = Number(this.equalizedHistSwitch.checked);
    if (!equalizedHist && tileGridSize === 0 && gamma === 0) {
      this.canvasContext.drawImage(this.offscreenCanvas, 0, 0);
      return;
    }
    const { width, height } = this.glfxCanvas;
    this.drawOffscreenCanvas(this.canvas, width, height);
    const src = cv.imread(this.offscreenCanvas);
    if (gamma !== 0) cv.LUT(src, this.lut, src);

    cv.cvtColor(src, src, cv.COLOR_BGR2Lab, 0);
    const size = new cv.Size(tileGridSize, tileGridSize);
    const clahe = new cv.CLAHE(clipLimit, size);
    const labPlanes = new cv.MatVector();
    cv.split(src, labPlanes);
    const mat = labPlanes.get(0);
    if (equalizedHist) cv.equalizeHist(mat, mat);
    if (tileGridSize !== 0) clahe.apply(mat, mat);
    cv.merge(labPlanes, src);
    cv.cvtColor(src, src, cv.COLOR_Lab2BGR, 0);
    cv.imshow(this.offscreenCanvas, src);
    src.delete();
    labPlanes.delete();
    mat.delete();
    clahe.delete();
    const texture = this.glfxCanvas.texture(this.offscreenCanvas);
    this.glfxCanvas.draw(texture).update();
  }

  addAspectRatioEvents(panel) {
    const radioInputs = panel.querySelectorAll("input[type=radio]");
    const manualRadioInput = radioInputs[radioInputs.length - 1];
    radioInputs.forEach((input) => {
      input.onclick = () => {
        if (input.checked == "true") return;
        input.checked = true;
        this.setAspectRatio(Number(input.value));
      };
    });
    panel.querySelector(".aspectRatioValue").onchange = (event) => {
      manualRadioInput.checked = true;
      const value = Number(event.currentTarget.value);
      if (value) this.setAspectRatio(value);
    };
  }

  addGlfxEvents(panel) {
    this.filtering = false;
    this.clipLimitRange = panel.querySelector(".clipLimitRange");
    this.tileGridSizeRange = panel.querySelector(".tileGridSizeRange");
    this.gammaRange = panel.querySelector(".gammaRange");
    this.equalizedHistSwitch = panel.querySelector(".equalizedHistSwitch");
    this.binarizationBlocksizeRange = panel.querySelector(
      ".binarizationBlocksizeRange",
    );
    this.binarizationCRange = panel.querySelector(".binarizationCRange");
    this.brightnessRange = panel.querySelector(".brightnessRange");
    this.contrastRange = panel.querySelector(".contrastRange");
    this.hueRange = panel.querySelector(".hueRange");
    this.saturationRange = panel.querySelector(".saturationRange");
    this.vibranceRange = panel.querySelector(".vibranceRange");
    this.denoiseRange = panel.querySelector(".denoiseRange");
    this.unsharpMaskRadiusRange = panel.querySelector(
      ".unsharpMaskRadiusRange",
    );
    this.unsharpMaskStrengthRange = panel.querySelector(
      ".unsharpMaskStrengthRange",
    );
    this.sepiaRange = panel.querySelector(".sepiaRange");

    this.clipLimitRange.oninput = () => this.clahe();
    this.clipLimitRange.onchange = () => this.clahe();
    this.tileGridSizeRange.oninput = () => this.clahe();
    this.tileGridSizeRange.onchange = () => this.clahe();
    this.gammaRange.oninput = () => {
      this.setLUT();
      this.clahe();
    };
    this.gammaRange.onchange = () => {
      this.setLUT();
      this.clahe();
    };
    this.equalizedHistSwitch.onchange = () => this.clahe();
    this.binarizationBlocksizeRange.oninput = () => this.binarization();
    this.binarizationBlocksizeRange.onchange = () => this.binarization();
    this.binarizationCRange.oninput = () => this.binarization();
    this.binarizationCRange.onchange = () => this.binarization();
    this.brightnessRange.oninput = () => this.brightnessContrast();
    this.brightnessRange.onchange = () => this.brightnessContrast();
    this.contrastRange.oninput = () => this.brightnessContrast();
    this.contrastRange.onchange = () => this.brightnessContrast();
    this.hueRange.oninput = () => this.hueSaturation();
    this.hueRange.onchange = () => this.hueSaturation();
    this.saturationRange.oninput = () => this.hueSaturation();
    this.saturationRange.onchange = () => this.hueSaturation();
    this.vibranceRange.oninput = () => this.vibrance();
    this.vibranceRange.onchange = () => this.vibrance();
    this.denoiseRange.oninput = () => this.denoise();
    this.denoiseRange.onchange = () => this.denoise();
    this.unsharpMaskRadiusRange.oninput = () => this.unsharpMask();
    this.unsharpMaskRadiusRange.onchange = () => this.unsharpMask();
    this.unsharpMaskStrengthRange.oninput = () => this.unsharpMask();
    this.unsharpMaskStrengthRange.onchange = () => this.unsharpMask();
    this.sepiaRange.oninput = () => this.sepia();
    this.sepiaRange.onchange = () => this.sepia();

    panel.querySelector(".clipLimitReset").onclick = () => {
      this.clipLimitRange.value = this.clipLimitRange.dataset.value;
      this.clahe();
    };
    panel.querySelector(".tileGridSizeReset").onclick = () => {
      this.tileGridSizeRange.value = this.tileGridSizeRange.dataset.value;
      this.clahe();
    };
    panel.querySelector(".gammaReset").onclick = () => {
      this.gammaRange.value = this.gammaRange.dataset.value;
      this.clahe();
    };
    panel.querySelector(".binarizationCReset").onclick = () => {
      this.binarizationCRange.value = this.binarizationCRange.dataset.value;
      this.binarization();
    };
    panel.querySelector(".brightnessReset").onclick = () => {
      this.brightnessRange.value = this.brightnessRange.dataset.value;
      this.brightnessContrast();
    };
    panel.querySelector(".contrastReset").onclick = () => {
      this.contrastRange.value = this.contrastRange.dataset.value;
      this.brightnessContrast();
    };
    panel.querySelector(".hueReset").onclick = () => {
      this.hueRange.value = this.hueRange.dataset.value;
      this.hueSaturation();
    };
    panel.querySelector(".saturationReset").onclick = () => {
      this.saturationRange.value = this.saturationRange.dataset.value;
      this.hueSaturation();
    };
    panel.querySelector(".vibranceReset").onclick = () => {
      this.vibranceRange.value = this.vibranceRange.dataset.value;
      this.vibrance();
    };
    panel.querySelector(".denoiseReset").onclick = () => {
      this.denoiseRange.value = this.denoiseRange.dataset.value;
      this.denoise();
    };
    panel.querySelector(".unsharpMaskRadiusReset").onclick = () => {
      this.unsharpMaskRadiusRange.value =
        this.unsharpMaskRadiusRange.dataset.value;
      this.unsharpMask();
    };
    panel.querySelector(".unsharpMaskStrengthReset").onclick = () => {
      this.unsharpMaskStrengthRange.value =
        this.unsharpMaskStrengthRange.dataset.value;
      this.unsharpMask();
    };
    panel.querySelector(".sepiaReset").onclick = () => {
      this.sepiaRange.value = this.sepiaRange.dataset.value;
      this.sepia();
    };
  }

  drawOffscreenCanvas(image, width, height) {
    const canvas = this.offscreenCanvas;
    canvas.width = width;
    canvas.height = height;
    this.offscreenCanvasContext.drawImage(
      image,
      0,
      0,
      width,
      height,
    );
  }

  setAspectRatio(aspectRatio) {
    const { width, height } = this.canvas;
    const currAspectRatio = width / height;
    let tmpWidth, tmpHeight;
    if (aspectRatio === 0) {
      tmpWidth = width;
      tmpHeight = height;
    } else if (currAspectRatio < aspectRatio) {
      tmpWidth = height * aspectRatio;
      tmpHeight = height;
    } else {
      tmpWidth = width;
      tmpHeight = width / aspectRatio;
    }
    this.drawOffscreenCanvas(this.canvas, tmpWidth, tmpHeight);
    this.texture = this.glfxCanvas.texture(this.offscreenCanvas);
    this.glfxCanvas.draw(this.texture).update();
  }

  binarization() {
    const blockSize = Number(this.binarizationBlocksizeRange.value);
    if (blockSize === Number(this.binarizationBlocksizeRange.min)) {
      this.glfxCanvas.draw(this.texture).update();
    } else {
      const C = Number(this.binarizationCRange.value);
      const { width, height } = this.glfxCanvas;
      this.drawOffscreenCanvas(this.canvas, width, height);
      const src = cv.imread(this.offscreenCanvas);
      cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
      cv.adaptiveThreshold(
        src,
        src,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        blockSize * 2 + 1,
        C,
      );
      cv.imshow(this.offscreenCanvas, src);
      src.delete();
      const texture = this.glfxCanvas.texture(this.offscreenCanvas);
      this.glfxCanvas.draw(texture).update();
    }
  }

  brightnessContrast() {
    if (this.filtering) return;
    this.filtering = true;
    const brightness = Number(this.brightnessRange.value);
    const contrast = Number(this.contrastRange.value);
    this.glfxCanvas.draw(this.texture)
      .brightnessContrast(brightness, contrast).update();
    this.filtering = false;
  }

  hueSaturation() {
    if (this.filtering) return;
    this.filtering = true;
    const hue = Number(this.hueRange.value);
    const saturation = Number(this.saturationRange.value);
    this.glfxCanvas.draw(this.texture)
      .hueSaturation(hue, saturation).update();
    this.filtering = false;
  }

  vibrance() {
    if (this.filtering) return;
    this.filtering = true;
    const value = Number(this.vibranceRange.value);
    this.glfxCanvas.draw(this.texture)
      .vibrance(value).update();
    this.filtering = false;
  }

  denoise() {
    if (this.filtering) return;
    this.filtering = true;
    const value = Number(this.denoiseRange.value);
    if (value === Number(this.denoiseRange.max)) {
      this.glfxCanvas.draw(this.texture).update();
    } else {
      this.glfxCanvas.draw(this.texture)
        .denoise(value).update();
    }
    this.filtering = false;
  }

  unsharpMask() {
    if (this.filtering) return;
    this.filtering = true;
    const radius = Number(this.unsharpMaskRadiusRange.value);
    const strength = Number(this.unsharpMaskStrengthRange.value);
    this.glfxCanvas.draw(this.texture)
      .unsharpMask(radius, strength).update();
    this.filtering = false;
  }

  sepia() {
    if (this.filtering) return;
    this.filtering = true;
    const value = Number(this.sepiaRange.value);
    this.glfxCanvas.draw(this.texture)
      .sepia(value).update();
    this.filtering = false;
  }

  setCanvas(canvas) {
    if (canvas.tagName.toLowerCase() === "img") {
      this.canvas.width = canvas.naturalWidth;
      this.canvas.height = canvas.naturalHeight;
    } else {
      this.canvas.width = canvas.width;
      this.canvas.height = canvas.height;
    }
    this.canvasContext.drawImage(canvas, 0, 0);

    this.texture = this.glfxCanvas.texture(this.canvas);
    this.glfxCanvas.draw(this.texture).update();
    this.glfxCanvas.setAttribute("class", "w-100 h-100 object-fit-contain");
    this.canvas.replaceWith(this.glfxCanvas);
    canvas.setAttribute("class", "w-100 h-100 object-fit-contain");
    // this.canvas = canvas;
  }

  rotate() {
    const angle = 90;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const glfxCanvas = this.glfxCanvas;
    const width = glfxCanvas.width;
    const height = glfxCanvas.height;
    const radian = angle * Math.PI / 180;
    // const cosAngle = Math.abs(Math.cos(radian));
    // const sinAngle = Math.abs(Math.sin(radian));
    const cosAngle = Math.cos(radian);
    const sinAngle = Math.sin(radian);
    const rotatedWidth = cosAngle * width + sinAngle * height;
    const rotatedHeight = sinAngle * width + cosAngle * height;
    canvas.width = rotatedWidth;
    canvas.height = rotatedHeight;
    context.translate(rotatedWidth / 2, rotatedHeight / 2);
    context.rotate(radian);
    this.glfxCanvas.update();
    context.drawImage(this.glfxCanvas, -width / 2, -height / 2);
    this.texture = this.glfxCanvas.texture(canvas);
    this.glfxCanvas.draw(this.texture).update();
  }

  saveToAlbum() {
    this.glfxCanvas.update();
    thumbnailPanel.add(this.glfxCanvas);
  }
}

class ConfigPanel extends Panel {
  constructor(panel) {
    super(panel);
    this.offcanvas = new Offcanvas(panel);
    this.resolution = panel.querySelector(".resolution");
    this.serverAddress = panel.querySelector(".serverAddress");
    this.serverAddress.onchange = (event) => {
      localStorage.setItem("serverAddress", event.currentTarget.value);
    };
    panel.querySelector(".clearConfig").onclick = (event) =>
      this.clearConfig(event);
  }

  uploadServer() {
    if (this.serverAddress.value != "") {
      const formData = new FormData();
      const gallery = thumbnailPanel.gallery;
      for (let i = 0; i < gallery.children.length; i++) {
        let base64 = gallery.children[i].shadowRoot.querySelector("img").src;
        base64 = base64.slice(base64.indexOf("base64,") + 7);
        formData.append("files", this.base64toJpg(base64), i + ".jpg");
      }
      fetch(this.serverAddress.value, {
        method: "POST",
        body: formData,
        mode: "no-cors",
      }).then(() => {
      }).catch((err) => {
        console.log(err);
        alert(err);
      });
    } else {
      this.offcanvas.show();
    }
  }

  base64toJpg(base64) {
    const bin = atob(base64.replace(/^.*,/, ""));
    const buffer = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      buffer[i] = bin.charCodeAt(i);
    }
    return new Blob([buffer.buffer], { type: "image/jpeg" });
  }

  clearConfig(event) {
    localStorage.clear();
    const node = event.target;
    node.textContent = "✅ Cleared!";
    setTimeout(() => {
      node.textContent = "Clear Settings";
    }, 2000);
  }
}

const configPanel = new ConfigPanel(document.getElementById("configPanel"));
const thumbnailPanel = new ThumbnailPanel(
  document.getElementById("thumbnailPanel"),
);
const filterPanel = new FilterPanel(document.getElementById("filterPanel"));
const loadPanel = new LoadPanel(document.getElementById("loadPanel"));
const cameraPanel = new CameraPanel(document.getElementById("cameraPanel"));
loadConfig();
initLangSelect();
initTooltip();
document.getElementById("toggleDarkMode").onclick = toggleDarkMode;
globalThis.ondragover = (event) => {
  event.preventDefault();
};
globalThis.ondrop = (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  loadPanel.loadFile(file);
};
globalThis.addEventListener("paste", (event) => {
  const item = event.clipboardData.items[0];
  const file = item.getAsFile();
  if (!file) return;
  loadPanel.loadFile(file);
});

await loadScript(await getOpenCVPath());
cv = await cv();
