// 브라우저에서 참고 이미지를 업로드 전에 리사이즈/재압축한다.
// 서버 저장 용량과 요청 본문 크기를 줄여, 오브젝트 스토리지 없이도 실용적으로 동작하게 한다.

export const MAX_UPLOAD_DIMENSION = 1600;

export async function resizeImageForUpload(file: File): Promise<File> {
  const source = await loadImageSource(file);
  try {
    const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지를 변환할 수 없습니다.");
    ctx.drawImage(source.image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("이미지 변환에 실패했습니다.");

    const baseName = file.name.replace(/\.[^.]+$/, "") || "reference";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } finally {
    source.cleanup();
  }
}

type ImageSource = { image: CanvasImageSource; width: number; height: number; cleanup: () => void };

async function loadImageSource(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() };
    } catch {
      // 일부 형식은 createImageBitmap이 실패할 수 있어 <img> 폴백을 쓴다.
    }
  }

  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    element.src = url;
  });
  return {
    image: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    cleanup: () => URL.revokeObjectURL(url),
  };
}
