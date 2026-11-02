// 由 Canvas 畫出的透明範例，不使用外部照片或額外模型。
export async function createDemo(): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 800;
  const c = canvas.getContext("2d")!;
  c.translate(360, 30);
  c.lineCap = "round";
  c.strokeStyle = "#477762";
  c.lineWidth = 10;
  c.beginPath();
  c.moveTo(0, 520);
  c.bezierCurveTo(30, 330, -40, 180, 24, 70);
  c.stroke();
  const leaf = (
    x: number,
    y: number,
    rotation: number,
    scale: number,
    color: string,
  ) => {
    c.save();
    c.translate(x, y);
    c.rotate(rotation);
    c.scale(scale, scale);
    const g = c.createLinearGradient(0, 0, 140, -80);
    g.addColorStop(0, "#3e715e");
    g.addColorStop(1, color);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(40, -110, 130, -110, 162, -68);
    c.bezierCurveTo(133, 12, 48, 54, 0, 0);
    c.fill();
    c.strokeStyle = "#a9c5a4";
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(80, -25, 145, -65);
    c.stroke();
    c.restore();
  };
  leaf(4, 445, -0.12, 1.05, "#9ac7aa");
  leaf(7, 350, Math.PI + 0.26, 1.1, "#88b197");
  leaf(1, 270, -0.32, 1.1, "#aacda4");
  leaf(2, 200, Math.PI + 0.64, 0.9, "#8fb394");
  leaf(17, 120, -0.87, 0.9, "#b0cda5");
  const pot = c.createLinearGradient(-140, 0, 150, 0);
  pot.addColorStop(0, "#d77c62");
  pot.addColorStop(0.45, "#e4a184");
  pot.addColorStop(1, "#c06b55");
  c.fillStyle = pot;
  c.beginPath();
  c.moveTo(-157, 490);
  c.lineTo(157, 490);
  c.lineTo(125, 711);
  c.quadraticCurveTo(0, 756, -125, 711);
  c.closePath();
  c.fill();
  c.fillStyle = "#b86652";
  c.beginPath();
  c.ellipse(0, 491, 158, 24, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#504c38";
  c.beginPath();
  c.ellipse(0, 488, 141, 15, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#eba98b";
  c.lineWidth = 16;
  c.beginPath();
  c.moveTo(-151, 501);
  c.quadraticCurveTo(0, 540, 151, 501);
  c.stroke();
  c.fillStyle = "#ffecd5";
  c.font = "italic 28px Georgia";
  c.textAlign = "center";
  c.fillText("grow slow", 0, 630);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("範例建立失敗。"))),
      "image/png",
    ),
  );
  return new File([blob], "grow-slow.png", { type: "image/png" });
}
