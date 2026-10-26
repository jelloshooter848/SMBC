/*
 * One file from the device's chooser (SAVE DATA's Import backup, ASSET PACKS' Import pack (.zip)).
 * Call it inside the press's own event (MenuItem.gesture): iOS opens a chooser only there. The
 * input sits in the page, out of sight (iOS Safari opens one more reliably), and goes once a
 * file is chosen, or when the next chooser opens (a cancelled one sends no event).
 */

let picker: HTMLInputElement | null = null;

/** Opens the chooser for `accept` (an input's accept list); `onPicked` gets the file chosen. */
export function pickFile(accept: string, onPicked: (file: File) => void): void {
  if (typeof document === 'undefined') return;
  picker?.remove();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;';
  input.onchange = () => {
    const f = input.files?.[0];
    input.remove();
    if (picker === input) picker = null;
    if (f) onPicked(f);
  };
  document.body.appendChild(input);
  picker = input;
  input.click();
}

/** Opens the folder chooser (Import pack (folder)); `onPicked` gets the folder's files. */
export function pickFolder(onPicked: (files: File[]) => void): void {
  if (typeof document === 'undefined') return;
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.setAttribute('webkitdirectory', '');
  input.onchange = () => onPicked(Array.from(input.files ?? []));
  input.click();
}
