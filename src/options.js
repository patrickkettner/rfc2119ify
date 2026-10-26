const form = document.getElementById("modes");

browser.storage.sync.get({ mode: "upper" }).then((stored) => {
  form.elements.mode.value = stored.mode;
});

form.addEventListener("change", () => {
  browser.storage.sync.set({ mode: form.elements.mode.value });
});
