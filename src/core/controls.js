/**
 * The download/upload/reset bar every mounted workbook gets automatically —
 * without this, pasting just the mount `<div>` into an LMS page would give
 * students a form with no way to actually get their fillable PDF, which was
 * always meant to be part of what the Runtime provides, not something every
 * embedding page has to hand-wire itself.
 */
export function renderWorkbookControls(workbook) {
  const bar = document.createElement("div");
  bar.id = "wb-controls";
  bar.style.justifyContent = "center";

  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.className = "btn-primary download-pdf";
  downloadBtn.id = "wb-download-pdf-btn";
  downloadBtn.textContent = "Download PDF";
  downloadBtn.addEventListener("click", async () => {
    const bytes = await workbook.exportPDF();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workbook.config.id}-completed.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const uploadLabel = document.createElement("label");
  uploadLabel.id = "wb-upload-pdf-label";
  uploadLabel.className = "wb-upload-pdf-control";
  const uploadBtn = document.createElement("button");
  uploadBtn.type = "button";
  uploadBtn.className = "wb-upload-pdf-button";
  uploadBtn.textContent = "Upload filled PDF";
  const uploadInput = document.createElement("input");
  uploadInput.type = "file";
  uploadInput.id = "wb-upload-pdf-input";
  uploadInput.accept = "application/pdf";
  uploadBtn.addEventListener("click", () => uploadInput.click());
  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files[0];
    uploadInput.value = "";
    if (!file) return;
    status.textContent = "Reading PDF…";
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await workbook.importPDF(bytes);
      status.textContent = "PDF answers imported.";
    } catch (error) {
      console.error("Failed to import filled PDF", error);
      status.textContent = "Couldn’t import that PDF. Please upload a PDF downloaded from this workbook.";
    }
  });

  const status = document.createElement("span");
  status.className = "wb-upload-pdf-status";
  status.setAttribute("aria-live", "polite");
  uploadLabel.appendChild(uploadBtn);
  uploadLabel.appendChild(uploadInput);
  uploadLabel.appendChild(status);

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn-secondary";
  resetBtn.id = "wb-reset-btn";
  resetBtn.textContent = "Reset";
  resetBtn.addEventListener("click", () => workbook.clear());

  bar.appendChild(downloadBtn);
  bar.appendChild(uploadLabel);
  bar.appendChild(resetBtn);
  return bar;
}
