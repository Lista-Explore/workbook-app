import { destroyContentEditors } from "./ui/content-editor.js";
import { BuilderState } from "./builder-state.js";
import { BuilderDraftStore } from "./builder-storage.js";
import { renderWorkbookSettingsPanel } from "./ui/workbook-settings-panel.js";
import { renderWorksheetList } from "./ui/worksheet-list.js";
import { renderSectionEditor } from "./ui/section-editor.js";
import { renderPreviewPanel } from "./ui/preview-panel.js";
import { renderPublishPanel } from "./ui/publish-panel.js";
import { registerAllFields } from "../../src/fields/index.js?v=20260923-rich-text";

const AUTOSAVE_DELAY_MS = 400;

export async function startBuilderApp(root, initialConfig) {
  registerAllFields();

  const state = new BuilderState(initialConfig);
  // A fixed slot for "whatever is currently open in the Builder" — using
  // the workbook's own id would go stale the moment the designer changes it.
  // Tests may pass ?draftKey=... so parallel browser runs do not overwrite
  // each other's saved builder drafts while reloading the page.
  const draftKey = new URL(root.location?.href || document.location.href).searchParams.get("draftKey") || "current";
  const draftStore = new BuilderDraftStore(draftKey);
  let activeWorksheetId = state.workbook.worksheets[0]?.id || null;
  let saveTimer = null;

  const elements = {
    settings: root.querySelector("#builder-settings-panel"),
    worksheets: root.querySelector("#builder-worksheet-list"),
    sections: root.querySelector("#builder-section-editor"),
    preview: root.querySelector("#builder-preview-panel"),
    publish: root.querySelector("#builder-publish-panel"),
    status: root.querySelector("#builder-status-text"),
    clearAll: root.querySelector("#builder-clear-all-btn"),
    previewBtn: root.querySelector("#builder-preview-btn"),
    previewDialog: root.querySelector("#builder-preview-dialog"),
    previewCloseBtn: root.querySelector("#builder-preview-close-btn"),
    importInput: root.querySelector("#builder-import-input"),
  };

  if (elements.previewBtn && elements.previewDialog) {
    elements.previewBtn.addEventListener("click", () => {
      elements.previewDialog.style.width = "min(1180px, 96vw)";
      elements.previewDialog.style.maxWidth = "none";
      elements.previewDialog.showModal();
    });
  }
  if (elements.previewCloseBtn && elements.previewDialog) {
    elements.previewCloseBtn.addEventListener("click", () => {
      elements.previewDialog.close();
    });
  }

  function setStatus(text) {
    if (elements.status) elements.status.textContent = text;
  }

  function scheduleAutosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      await draftStore.save(state.toConfig());
      setStatus("Draft saved.");
    }, AUTOSAVE_DELAY_MS);
  }

  // Re-renders only what depends on the workbook's *values* (the preview)
  // without touching the settings/worksheets/sections DOM. Text inputs
  // (labels, titles, option text) call this on every keystroke — rebuilding
  // their own panel there would rip focus out of the field the person is
  // actively typing in.
  async function refreshDependents() {
    scheduleAutosave();
    await renderPreviewPanel(elements.preview, state);
    renderPublishPanel(elements.publish, state, { onStatus: setStatus });
  }

  // Full rebuild: used for structural changes (add/remove/reorder a
  // worksheet, section, or field; switching the active worksheet) where the
  // editing panels themselves must change shape.
  async function rerender() {
    destroyContentEditors();
    renderWorkbookSettingsPanel(elements.settings, state, refreshDependents);

    if (!activeWorksheetId || !state.workbook.worksheets.some((w) => w.id === activeWorksheetId)) {
      activeWorksheetId = state.workbook.worksheets[0]?.id || null;
    }

    renderWorksheetList(elements.worksheets, state, {
      activeWorksheetId,
      onSelect: (id) => {
        activeWorksheetId = id;
        rerender();
      },
      onChange: rerender,
      onRename: refreshDependents,
    });

    if (activeWorksheetId) {
      renderSectionEditor(elements.sections, state, activeWorksheetId, rerender, refreshDependents);
    } else {
      elements.sections.innerHTML = "";
    }

    await refreshDependents();
  }

  // Click-to-arm, click-again-to-confirm — not a native confirm() dialog,
  // which doesn't reliably surface (or can be silently auto-dismissed) in
  // every embedding context. Auto-reverts if the second click never comes.
  if (elements.clearAll) {
    const defaultLabel = elements.clearAll.textContent;
    let armed = false;
    let revertTimer = null;

    function disarm() {
      armed = false;
      clearTimeout(revertTimer);
      elements.clearAll.textContent = defaultLabel;
      elements.clearAll.classList.remove("builder-clear-all-btn-armed");
    }

    elements.clearAll.addEventListener("click", async () => {
      if (!armed) {
        armed = true;
        elements.clearAll.textContent = "Click again to confirm";
        elements.clearAll.classList.add("builder-clear-all-btn-armed");
        revertTimer = setTimeout(disarm, 8000);
        return;
      }

      disarm();
      clearTimeout(saveTimer);
      state.reset();
      activeWorksheetId = null;
      await draftStore.clear();
      setStatus("Cleared. Starting a new workbook.");
      await rerender();
    });
  }

  // Reuse/edit a previously downloaded workbook — the ".json" produced by
  // "Download workbook definition" is the one lossless, round-trippable
  // format (a PDF or the mount snippet alone don't carry the full
  // structure back out), so that's what gets read back in here.
  if (elements.importInput) {
    elements.importInput.addEventListener("change", async () => {
      const file = elements.importInput.files[0];
      elements.importInput.value = "";
      if (!file) return;

      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        setStatus(`Couldn't read "${file.name}" — it doesn't look like a workbook definition.`);
        return;
      }
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.worksheets)) {
        setStatus(`"${file.name}" isn't a workbook definition.`);
        return;
      }

      clearTimeout(saveTimer);
      state.load(parsed);
      activeWorksheetId = state.workbook.worksheets[0]?.id || null;
      await draftStore.save(state.toConfig());
      setStatus(`Imported "${parsed.title || parsed.id || file.name}".`);
      await rerender();
    });
  }

  const savedDraft = await draftStore.load();
  if (savedDraft) {
    state.load(savedDraft);
    activeWorksheetId = state.workbook.worksheets[0]?.id || null;
  }

  await rerender();

  return { state, rerender };
}
