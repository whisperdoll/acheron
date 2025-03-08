import Point from "./point";
import Rectangle from "./rectangle";

export type CanvasOptions = {
  canvasElement?: HTMLCanvasElement;
  size?: Point;
  align?: {
    horizontal: boolean;
    vertical: boolean;
  };
  deepCalc?: boolean;
  pixelated?: boolean;
  opaque?: boolean;
};

type CanvasTextBaseline =
  | "top"
  | "hanging"
  | "middle"
  | "alphabetic"
  | "ideographic"
  | "bottom";
type CanvasTextAlign = "start" | "end" | "left" | "right" | "center";

type MouseMoveFn = (
  pos: Point,
  isDown: boolean,
  lastPos: Point,
  originalPos: Point,
  e: MouseEvent | TouchEvent
) => any;
type MouseDownFn = (pos: Point, e: MouseEvent | TouchEvent) => any;
type MouseUpFn = (
  pos: Point,
  originalPos: Point,
  e: MouseEvent | TouchEvent
) => any;
type MouseLeaveFn = (pos: Point, e: MouseEvent | TouchEvent) => any;

type Drawable = HTMLImageElement | Canvas | HTMLCanvasElement;

type CanvasMouse = {
  isDown: boolean;
  lastPos: Point | null;
  originalPos: Point;
  events: {
    move: MouseMoveFn[];
    down: MouseDownFn[];
    up: MouseUpFn[];
    leave: MouseLeaveFn[];
  };
};

export class Canvas {
  canvas: HTMLCanvasElement;
  translation: Point;
  align: { horizontal: boolean; vertical: boolean };
  usingDeepCalc: boolean;
  mouse: CanvasMouse;
  offset: Point = new Point(0);
  public readonly context: CanvasRenderingContext2D;
  private static triangleCanvas: HTMLCanvasElement | null = null;

  constructor(options: CanvasOptions = {}) {
    if (Canvas.triangleCanvas === null) {
      Canvas.triangleCanvas = document.createElement("canvas");
      Canvas.triangleCanvas.width = 12;
      Canvas.triangleCanvas.height = 12;

      var ctx = Canvas.triangleCanvas.getContext("2d")!;
      ctx.fillStyle = "White";

      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(11, 8);
      ctx.lineTo(0, 8);
      ctx.lineTo(6, 0);
      ctx.fill();
    }

    options = options || {};

    if (!options.canvasElement) {
      options.canvasElement = document.createElement("canvas");
    } else if (typeof options.canvasElement === "string") {
      options.canvasElement =
        document.querySelector(options.canvasElement) || undefined;
    }

    this.canvas = options.canvasElement as HTMLCanvasElement;
    this.context = this.canvas.getContext("2d", {
      alpha: !options.opaque,
    }) as CanvasRenderingContext2D;

    if (options.size) {
      this.resize(options.size, false);
    }

    this.translation = new Point(0);

    this.align = {
      horizontal: (options.align && options.align.horizontal) || false,
      vertical: (options.align && options.align.vertical) || false,
    };

    if (this.align.horizontal || this.align.vertical) {
      //this.canvas.style.transformOrigin = "center";
      //this.canvas.style.position = "absolute";
      /*if (this.align.horizontal && this.align.vertical)
            {
                this.canvas.style.transform = "translate(-50%, -50%)";
                this.canvas.style.left = "50%";
                this.canvas.style.top = "50%";
            }
            else if (this.align.horizontal)
            {
                this.canvas.style.transform = "translateX(-50%)";
                this.canvas.style.left = "50%";
            }
            else // vertical
            {
                this.canvas.style.transform = "translateY(-50%)";
                this.canvas.style.top = "50%";
            }*/
    } else {
      //this.canvas.style.transformOrigin = "top left";
    }

    this.usingDeepCalc = options.deepCalc || false;
    if (options.pixelated) {
      this.pixelated = options.pixelated || false;
    }

    if (this.usingDeepCalc) {
      this.deepCalcPosition();
      window.addEventListener("resize", this.deepCalcPosition);
    }

    this.mouse = {
      isDown: false,
      lastPos: null,
      originalPos: new Point(-1),
      events: {
        move: [],
        down: [],
        up: [],
        leave: [],
      },
    };

    this.canvas.addEventListener("mousemove", this.mouseMove.bind(this));
    this.canvas.addEventListener("touchmove", this.mouseMove.bind(this));
    this.canvas.addEventListener("mousedown", this.mouseDown.bind(this));
    this.canvas.addEventListener("touchstart", this.mouseDown.bind(this));
    this.canvas.addEventListener("mouseup", this.mouseUp.bind(this));
    this.canvas.addEventListener("touchend", this.mouseUp.bind(this));
    this.canvas.addEventListener("mouseleave", this.mouseLeave.bind(this));
    this.canvas.addEventListener("touchcancel", this.mouseLeave.bind(this));
  }

  public addEventListener(eventName: "mouseup", fn: MouseUpFn): void;
  public addEventListener(eventName: "mousedown", fn: MouseDownFn): void;
  public addEventListener(eventName: "mousemove", fn: MouseMoveFn): void;
  public addEventListener(eventName: "mouseleave", fn: MouseLeaveFn): void;
  public addEventListener(eventName: string, fn: Function): void {
    if (
      ["mouseup", "mousedown", "mousemove", "mouseleave"].includes(eventName)
    ) {
      (this.mouse.events as any)[eventName.substr(5)].push(fn);
    }
  }

  public removeEventListener(eventName: "mouseup", fn: MouseUpFn): void;
  public removeEventListener(eventName: "mousedown", fn: MouseDownFn): void;
  public removeEventListener(eventName: "mousemove", fn: MouseMoveFn): void;
  public removeEventListener(eventName: "mouseleave", fn: MouseLeaveFn): void;
  public removeEventListener(eventName: string, fn: Function): void {
    if (
      ["mouseup", "mousedown", "mousemove", "mouseleave"].includes(eventName)
    ) {
      const arr = (this.mouse.events as any)[eventName.substr(5)];
      if (arr.indexOf(fn) !== -1) {
        arr.splice(arr.indexOf(fn), 1);
      } else {
        throw new Error("Event listener fn doesn't exist");
      }
    }
  }

  public resize(size: Point, redraw: boolean) {
    let c: HTMLCanvasElement | null = null;

    if (redraw) {
      c = this.canvas.cloneNode() as HTMLCanvasElement;
    }

    this.canvas.width = size.x;
    this.canvas.height = size.y;

    if (redraw) {
      this.drawImage(c as HTMLCanvasElement, new Point(0));
    }
  }

  public zoom(
    amount: number | Point,
    transformPrefix: string,
    transformPostfix: string
  ) {
    let x: number;
    let y: number;

    if (typeof amount === "number") {
      x = amount;
      y = amount;
    } else {
      x = amount.x;
      y = amount.y;
    }

    this.canvas.style.transform =
      transformPrefix +
      " scale(" +
      x.toString() +
      "," +
      y.toString() +
      ") " +
      transformPostfix;
  }

  public zoomToFit(
    size: Point,
    transformPrefix: string,
    transformPostfix: string
  ) {
    let wRatio = size.x / this.width;
    let hRatio = size.y / this.height;

    if (wRatio < hRatio) {
      this.zoom(wRatio, transformPrefix, transformPostfix);
    } else {
      this.zoom(hRatio, transformPrefix, transformPostfix);
    }
  }

  public scale(
    amount: number | Point,
    transformPrefix: string,
    transformPostfix: string
  ) {
    return this.zoom(amount, transformPrefix, transformPostfix);
  }

  public clear() {
    this.context.clearRect(
      -this.translation.x,
      -this.translation.y,
      this.canvas.width,
      this.canvas.height
    );
  }

  private deepCalcPosition() {
    let z = this.canvas as HTMLElement,
      x = 0,
      y = 0,
      c;

    while (z && !isNaN(z.offsetLeft) && !isNaN(z.offsetTop)) {
      c = window.getComputedStyle(z, null);
      x +=
        z.offsetLeft -
        z.scrollLeft +
        (c ? parseInt(c.getPropertyValue("border-left-width"), 10) : 0);
      y +=
        z.offsetTop -
        z.scrollTop +
        (c ? parseInt(c.getPropertyValue("border-top-width"), 10) : 0);
      z = z.offsetParent as HTMLElement;
    }

    this.offset = new Point(x, y);
  }

  private posFromEvent(e: MouseEvent | TouchEvent): Point {
    let ret = new Point();

    if (e instanceof MouseEvent) {
      ret = new Point(e.pageX, e.pageY);
    } else {
      ret = new Point(e.changedTouches[0].pageX, e.changedTouches[0].pageY);
    }

    if (this.usingDeepCalc) {
      this.deepCalcPosition();
    }

    let bounds = this.canvas.getBoundingClientRect();

    let o = this.usingDeepCalc
      ? this.offset.copy()
      : new Point(bounds.left, bounds.top);

    if (this.align.horizontal && o.x > 0) {
      o.x = (2 * o.x - bounds.width) / 2;
    }

    if (this.align.vertical && o.y > 0) {
      o.y = (2 * o.y - bounds.height) / 2;
    }

    ret.subtract(o);
    ret.multiply(this.size.dividedBy(new Point(bounds.width, bounds.height)));

    return ret;
  }

  public get size(): Point {
    return new Point(this.canvas.width, this.canvas.height);
  }

  private mouseMove(e: MouseEvent | TouchEvent): void {
    let pos = this.posFromEvent(e);
    if (!this.mouse.lastPos) this.mouse.lastPos = pos;
    if (!this.mouse.isDown) this.mouse.originalPos = pos;

    this.mouse.events.move.forEach((fn) => {
      let event = fn.call(
        this,
        pos,
        this.mouse.isDown,
        this.mouse.lastPos as Point,
        this.mouse.originalPos,
        e
      );

      if (event !== false) {
        this.mouse.lastPos = pos;
      }
    });
  }

  private mouseDown(e: MouseEvent | TouchEvent): void {
    let pos = this.posFromEvent(e);
    this.mouse.isDown = true;
    this.mouse.lastPos = pos;
    this.mouse.originalPos = pos;

    this.mouse.events.down.forEach((fn) => {
      fn.call(this, pos, e);
    });
  }

  private mouseUp(e: MouseEvent | TouchEvent): void {
    let pos = this.posFromEvent(e);
    this.mouse.isDown = false;

    this.mouse.events.up.forEach((fn) => {
      fn.call(this, pos, this.mouse.originalPos, e);
    });

    this.mouse.lastPos = pos;
  }

  private mouseLeave(e: MouseEvent | TouchEvent): void {
    let pos = this.posFromEvent(e);

    this.mouse.events.leave.forEach((fn) => {
      fn.call(this, pos, e);
    });
  }

  public set pixelated(bool: boolean) {
    bool = !bool;

    let ctx = this.context;
    (ctx as any).mozImageSmoothingEnabled = bool;
    (ctx as any).webkitImageSmoothingEnabled = bool;
    //(ctx as any).msImageSmoothingEnabled = bool;
    (ctx as any).imageSmoothingEnabled = bool;

    if (!bool) {
      let types = [
        "optimizeSpeed",
        "crisp-edges",
        "-moz-crisp-edges",
        "-webkit-optimize-contrast",
        "optimize-contrast",
        "pixelated",
      ];

      types.forEach((type) => (this.canvas.style.imageRendering = type));
    } else {
      this.canvas.style.imageRendering = "";
    }
    //this.canvas.style.msInterpolationMode = "nearest-neighbor";
  }

  public get width(): number {
    return this.canvas.width;
  }
  public get height(): number {
    return this.canvas.height;
  }

  public get opacity(): number {
    return this.context.globalAlpha;
  }
  public set opacity(opacity: number) {
    this.context.globalAlpha = opacity;
  }

  public get color(): string {
    return this.context.fillStyle as string;
  }
  public set color(val: string) {
    if (val === undefined) return;

    this.context.fillStyle = val;
    this.context.strokeStyle = val;
  }

  public get font(): string {
    return this.context.font;
  }
  public set font(val: string) {
    if (val === undefined) return;

    this.context.font = val;
  }

  public get lineWidth(): number {
    return this.context.lineWidth;
  }
  public set lineWidth(val: number) {
    if (val === undefined) return;

    this.context.lineWidth = val;
  }

  public get blendMode(): GlobalCompositeOperation {
    return this.context.globalCompositeOperation;
  }
  public set blendMode(val: GlobalCompositeOperation) {
    this.context.globalCompositeOperation = val;
  }

  public get lineDash(): number[] {
    return this.context.getLineDash();
  }
  public set lineDash(dash: number[]) {
    this.context.setLineDash(dash);
  }

  public createBlob(callback: (blob: Blob) => any, mimeType?: string): void {
    this.canvas.toBlob(function (blob) {
      callback(blob as Blob);
    }, mimeType);
  }

  public createImage(
    callback: (image: HTMLImageElement) => any,
    mimeType?: string,
    autoRevoke: boolean = true
  ) {
    this.canvas.toBlob(function (blob) {
      if (!blob) throw "couldnt blob canvas";
      let ret = new Image();

      ret.onload = () => {
        callback(ret);
        ret.onload = null;
        autoRevoke && URL.revokeObjectURL(ret.src);
      };

      let url = URL.createObjectURL(blob);
      ret.src = url;
    }, mimeType);
  }

  public get imageData(): ImageData {
    return this.context.getImageData(0, 0, this.width, this.height);
  }

  public drawImage(image: Drawable, position: Point | Rectangle): void {
    if (image instanceof Canvas) {
      image = image.canvas;
    }

    if (position instanceof Point) {
      this.context.drawImage(image, position.x, position.y);
    } else {
      this.context.drawImage(
        image,
        position.x,
        position.y,
        position.width,
        position.height
      );
    }
  }

  public drawCroppedImage(
    image: Drawable,
    position: Point | Rectangle,
    cropRegion: Rectangle
  ): void {
    if (image instanceof Canvas) {
      image = image.canvas;
    }

    if (position instanceof Point) {
      this.context.drawImage(
        image,
        cropRegion.x,
        cropRegion.y,
        cropRegion.width,
        cropRegion.height,
        position.x,
        position.y,
        cropRegion.width,
        cropRegion.height
      );
    } else {
      this.context.drawImage(
        image,
        cropRegion.x,
        cropRegion.y,
        cropRegion.width,
        cropRegion.height,
        position.x,
        position.y,
        position.width,
        position.height
      );
    }
  }

  public drawRotatedCroppedImage(
    image: Drawable,
    rotate: number,
    anchor: Point,
    position: Point | Rectangle,
    cropRegion: Rectangle
  ): void {
    if (image instanceof Canvas) {
      image = image.canvas;
    }

    var ctx = this.context;

    ctx.save();
    ctx.translate(position.x + anchor.x, position.y + anchor.y);
    ctx.rotate(rotate);

    if (position instanceof Point) {
      ctx.drawImage(
        image,
        cropRegion.x,
        cropRegion.y,
        cropRegion.width,
        cropRegion.height,
        -anchor.x,
        -anchor.y,
        image.width,
        image.height
      );
    } else {
      ctx.drawImage(
        image,
        cropRegion.x,
        cropRegion.y,
        cropRegion.width,
        cropRegion.height,
        -anchor.x,
        -anchor.y,
        position.width,
        position.height
      );
    }

    ctx.restore();
  }

  public fillWithImage(image: Drawable, resizeCanvasToFit: boolean): void {
    if (resizeCanvasToFit) {
      this.resize(new Point(image.width, image.height), false);
    }

    this.drawImage(image, new Point(0));
  }

  public drawLine(
    start: Point,
    end: Point,
    color?: string,
    lineWidth?: number
  ): void {
    if (color) this.color = color;
    if (lineWidth) this.lineWidth = lineWidth;

    this.context.beginPath();
    this.context.moveTo(start.x, start.y);
    this.context.lineTo(end.x, end.y);
    this.context.stroke();
  }

  public drawRect(
    rect: Rectangle,
    color: string,
    lineWidth: number,
    sharp: boolean = true
  ): void {
    this.color = color;
    this.lineWidth = lineWidth;

    if (sharp) {
      rect = rect.translated(new Point(0.5));
    }

    this.context.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  public fillRect(rect: Rectangle, color: string): void {
    this.color = color;

    this.context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  // https://stackoverflow.com/a/7838871
  public drawRoundedRect(
    rect: Rectangle,
    radius: number,
    color: string,
    lineWidth: number,
    sharp: boolean = true
  ): void {
    this.color = color;
    this.lineWidth = lineWidth;

    if (sharp) {
      rect = rect.translated(new Point(0.5));
    }

    if (rect.width < 2 * radius) radius = rect.width / 2;
    if (rect.height < 2 * radius) radius = rect.height / 2;

    this.context.beginPath();
    this.context.moveTo(rect.x + radius, rect.y);
    this.context.arcTo(rect.right, rect.y, rect.right, rect.bottom, radius);
    this.context.arcTo(rect.right, rect.bottom, rect.x, rect.bottom, radius);
    this.context.arcTo(rect.x, rect.bottom, rect.x, rect.y, radius);
    this.context.arcTo(rect.x, rect.y, rect.right, rect.y, radius);
    this.context.closePath();
    this.context.stroke();
  }

  public fillRoundedRect(
    rect: Rectangle,
    radius: number,
    color: string,
    sharp: boolean = true
  ): void {
    this.color = color;

    if (sharp) {
      rect = rect.translated(new Point(0.5));
    }

    if (rect.width < 2 * radius) radius = rect.width / 2;
    if (rect.height < 2 * radius) radius = rect.height / 2;

    this.context.beginPath();
    this.context.moveTo(rect.x + radius, rect.y);
    this.context.arcTo(rect.right, rect.y, rect.right, rect.bottom, radius);
    this.context.arcTo(rect.right, rect.bottom, rect.x, rect.bottom, radius);
    this.context.arcTo(rect.x, rect.bottom, rect.x, rect.y, radius);
    this.context.arcTo(rect.x, rect.y, rect.right, rect.y, radius);
    this.context.closePath();
    this.context.fill();
  }

  public fill(color: string): void {
    this.fillRect(new Rectangle(new Point(0), this.size), color);
  }

  public fillText(
    text: string,
    position: Point,
    color: string,
    baseline?: CanvasTextBaseline,
    align?: CanvasTextAlign,
    font?: string
  ): void {
    this.color = color;

    if (font) {
      this.font = font;
    }
    if (baseline) {
      this.context.textBaseline = baseline;
    }
    if (align) {
      this.context.textAlign = align;
    }

    this.context.fillText(text, position.x, position.y);
  }

  public fillCircle(position: Point, radius: number, color: string): void {
    this.color = color;

    this.context.beginPath();
    this.context.arc(position.x, position.y, radius, 0, 2 * Math.PI, false);
    this.context.fill();
  }

  public drawCircle(
    position: Point,
    radius: number,
    color: string,
    lineWidth: number
  ): void {
    this.color = color;
    this.lineWidth = lineWidth;

    this.context.beginPath();
    this.context.arc(position.x, position.y, radius, 0, 2 * Math.PI, false);
    this.context.stroke();
  }

  public drawHexagon(
    position: Point,
    radius: number,
    color: string,
    lineWidth: number
  ): void {
    const a = (2 * Math.PI) / 6;

    this.color = color;
    this.lineWidth = lineWidth;

    this.context.beginPath();
    for (let i = 0; i < 6; i++) {
      this.context.lineTo(
        position.x + radius * Math.cos(a * i),
        position.y + radius * Math.sin(a * i)
      );
    }
    this.context.closePath();
    this.context.stroke();
  }

  public drawHexagonCell(
    startPosition: Point,
    cellCoordinate: Point,
    radius: number,
    startHigh: boolean,
    color: string,
    lineWidth: number,
    label?: string,
    directions?: number[]
  ) {
    const { x, y } = cellCoordinate;
    const a = (2 * Math.PI) / 6;

    this.color = color;
    this.lineWidth = lineWidth;

    const shouldStartHigh = startHigh ? x % 2 === 0 : x % 2 === 1;
    const startY = shouldStartHigh
      ? startPosition.y
      : startPosition.y + radius * Math.sin(a);

    this.context.beginPath();
    for (let i = 0; i < 6; i++) {
      this.context.lineTo(
        startPosition.x +
          radius * (1 + Math.cos(a)) * x +
          radius * Math.cos(a * i) +
          0.5,
        startY + radius * 2 * Math.sin(a) * y + radius * Math.sin(a * i) + 0.5
      );
    }
    this.context.closePath();
    this.context.stroke();
    const centerPt = new Point(
      startPosition.x + radius * (1 + Math.cos(a)) * x,
      startY + radius * 2 * Math.sin(a) * y + 5
    );

    if (label) {
      const fontSize = 12;
      const lines = label.split("\n");
      const start = (-1 / 2) * fontSize * (lines.length - 1);

      lines.forEach((line, i) => {
        this.fillText(
          line,
          centerPt.plus(new Point(0, start + (fontSize + 4) * i)),
          i === 0 ? color : "#FFFFFF",
          undefined,
          "center",
          fontSize * 1.225 + "px sans-serif"
        );
      });
    }

    if (directions) {
      directions.forEach((direction) => {
        const angle = (direction / 6) * Math.PI * 2 - Math.PI / 2;
        this.drawRotatedImage(
          Canvas.triangleCanvas!,
          angle + Math.PI / 2,
          centerPt
            .minus(new Point(0, 5))
            .plus(
              new Point(Math.cos(angle), Math.sin(angle)).times(radius - 16)
            )
            .minus(Point.fromSizeLike(Canvas.triangleCanvas!).dividedBy(2))
        );
      });
    }
  }

  public fillHexagonCell(
    startPosition: Point,
    cellCoordinate: Point,
    radius: number,
    startHigh: boolean,
    color: string
  ) {
    const { x, y } = cellCoordinate;
    const a = (2 * Math.PI) / 6;

    this.color = color;

    const shouldStartHigh = startHigh ? x % 2 === 0 : x % 2 === 1;
    const startY = shouldStartHigh
      ? startPosition.y
      : startPosition.y + radius * Math.sin(a);

    this.context.beginPath();
    for (let i = 0; i < 6; i++) {
      this.context.lineTo(
        startPosition.x +
          radius * (1 + Math.cos(a)) * x +
          radius * Math.cos(a * i) +
          0.5,
        startY + radius * 2 * Math.sin(a) * y + radius * Math.sin(a * i) + 0.5
      );
    }
    this.context.closePath();
    this.context.fill();
  }

  public drawHexagonGridDecorations(
    startPosition: Point,
    radius: number,
    gridDims: Point,
    startHigh: boolean,
    color: string,
    labels: string[],
    directions: number[][]
  ) {
    const a = (2 * Math.PI) / 6;

    this.color = color;

    for (let y = 0; y < gridDims.y; y++) {
      for (let x = 0; x < gridDims.x; x++) {
        const shouldStartHigh = startHigh ? x % 2 === 0 : x % 2 === 1;
        const startY = shouldStartHigh
          ? startPosition.y
          : startPosition.y + radius * Math.sin(a);

        const index = x * gridDims.y + y;
        const centerPt = new Point(
          startPosition.x + radius * (1 + Math.cos(a)) * x,
          startY + radius * 2 * Math.sin(a) * y + 5
        );

        if (labels[index]) {
          const fontSize = 12;
          const lines = labels[index].split("\n");
          const start = (-1 / 2) * fontSize * (lines.length - 1);

          lines.forEach((line, i) => {
            this.fillText(
              line,
              centerPt.plus(new Point(0, start + (fontSize + 4) * i)),
              i === 0 ? color : "#FFFFFF",
              undefined,
              "center",
              i != 0
                ? fontSize * 1.25 + "px sans-serif"
                : fontSize * 0.95 + "px sans-serif"
            );
          });

          this.color = color;
        }

        directions[index].forEach((direction) => {
          const angle = (direction / 6) * Math.PI * 2 - Math.PI / 2;
          this.drawRotatedImage(
            Canvas.triangleCanvas!,
            angle + Math.PI / 2,
            centerPt
              .minus(new Point(0, 5))
              .plus(
                new Point(Math.cos(angle), Math.sin(angle)).times(radius - 16)
              )
              .minus(Point.fromSizeLike(Canvas.triangleCanvas!).dividedBy(2))
          );
        });
      }
    }
  }

  public drawHexagonGrid(
    startPosition: Point,
    radius: number,
    gridDims: Point,
    startHigh: boolean,
    color: string,
    lineWidth: number,
    labels?: string[],
    directions?: number[][]
  ): Point[] {
    const a = (2 * Math.PI) / 6;

    this.color = color;
    this.lineWidth = lineWidth;

    const pts = [];

    for (let y = 0; y < gridDims.y; y++) {
      for (let x = 0; x < gridDims.x; x++) {
        const shouldStartHigh = startHigh ? x % 2 === 0 : x % 2 === 1;
        const startY = shouldStartHigh
          ? startPosition.y
          : startPosition.y + radius * Math.sin(a);

        this.context.beginPath();
        for (let i = 0; i < 6; i++) {
          this.context.lineTo(
            startPosition.x +
              radius * (1 + Math.cos(a)) * x +
              radius * Math.cos(a * i) +
              0.5,
            startY +
              radius * 2 * Math.sin(a) * y +
              radius * Math.sin(a * i) +
              0.5
          );
        }
        this.context.closePath();
        this.context.stroke();

        const index = x * gridDims.y + y;

        pts[index] = new Point(
          startPosition.x + radius * (1 + Math.cos(a)) * x,
          startY + radius * 2 * Math.sin(a) * y
        );

        const centerPt = new Point(
          startPosition.x + radius * (1 + Math.cos(a)) * x,
          startY + radius * 2 * Math.sin(a) * y + 5
        );

        if (labels && labels[index]) {
          const fontSize = 12;
          const lines = labels[index].split("\n");
          const start = (-1 / 2) * fontSize * (lines.length - 1);

          lines.forEach((line, i) => {
            this.fillText(
              line,
              centerPt.plus(new Point(0, start + (fontSize + 4) * i)),
              i === 0 ? color : "#FFFFFF",
              undefined,
              "center",
              fontSize * 1.225 + "px sans-serif"
            );
          });

          this.color = color;
        }

        if (directions && directions[index]) {
          directions[index].forEach((direction) => {
            const angle = (direction / 6) * Math.PI * 2 - Math.PI / 2;
            this.drawRotatedImage(
              Canvas.triangleCanvas!,
              angle + Math.PI / 2,
              centerPt
                .minus(new Point(0, 5))
                .plus(
                  new Point(Math.cos(angle), Math.sin(angle)).times(radius - 16)
                )
                .minus(Point.fromSizeLike(Canvas.triangleCanvas!).dividedBy(2))
            );
          });
        }
      }
    }

    return pts;
  }

  public fillCircleInSquare(position: Point, diameter: number, color: string) {
    this.color = color;

    this.context.beginPath();
    this.context.arc(
      position.x + diameter / 2,
      position.y + diameter / 2,
      diameter / 2,
      0,
      2 * Math.PI,
      false
    );
    this.context.fill();
  }

  public drawCircleInSquare(
    position: Point,
    diameter: number,
    color: string,
    lineWidth: number
  ): void {
    this.color = color;
    this.lineWidth = lineWidth;

    this.context.beginPath();
    this.context.arc(
      position.x + diameter / 2,
      position.y + diameter / 2,
      diameter / 2,
      0,
      2 * Math.PI,
      false
    );
    this.context.stroke();
  }

  public fillCircleInRect(rect: Rectangle, color: string): void {
    if (rect.isSquare) {
      return this.fillCircleInSquare(rect.position, rect.width, color);
    }

    this.color = color;

    this.context.beginPath();
    this.context.ellipse(
      rect.x,
      rect.y,
      rect.width / 2,
      rect.height / 2,
      0,
      0,
      Math.PI * 2
    );
    this.context.fill();
  }

  public drawCircleInRect(
    rect: Rectangle,
    color: string,
    lineWidth: number
  ): void {
    if (rect.isSquare) {
      return this.drawCircleInSquare(
        rect.position,
        rect.width,
        color,
        lineWidth
      );
    }

    this.color = color;
    this.lineWidth = lineWidth;

    this.context.beginPath();
    this.context.ellipse(
      rect.x,
      rect.y,
      rect.width / 2,
      rect.height / 2,
      0,
      0,
      Math.PI * 2
    );
    this.context.stroke();
  }

  public drawRotatedImage(
    image: Drawable,
    rotate: number,
    position: Point | Rectangle
  ): void {
    if (image instanceof Canvas) {
      image = image.canvas;
    }

    let w: number;
    let h: number;

    if (position instanceof Point) {
      w = image.width;
      h = image.height;
    } else {
      w = position.width;
      h = position.height;
    }

    this.context.save();
    this.context.translate(position.x + w / 2, position.y + h / 2);
    this.context.rotate(rotate);
    this.context.drawImage(image, -w / 2, -h / 2, w, h);
    this.context.restore();
  }

  public static fileToImage(
    file: File,
    callback: (image: HTMLImageElement) => any,
    autoRevoke: boolean = true
  ) {
    let img = new Image();

    img.onload = () => {
      callback(img);
      if (autoRevoke) {
        window.URL.revokeObjectURL(img.src);
      }
    };

    img.src = window.URL.createObjectURL(file);
  }
}

// from https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
if (!HTMLCanvasElement.prototype.toBlob) {
  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
    value: function (callback: any, type: any, quality: any) {
      var canvas = this;
      setTimeout(function () {
        var binStr = atob(canvas.toDataURL(type, quality).split(",")[1]),
          len = binStr.length,
          arr = new Uint8Array(len);

        for (var i = 0; i < len; i++) {
          arr[i] = binStr.charCodeAt(i);
        }

        callback(new Blob([arr], { type: type || "image/png" }));
      });
    },
  });
}
