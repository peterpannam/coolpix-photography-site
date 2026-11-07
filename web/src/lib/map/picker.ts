/** "All locations": a searchable list of every place, grouped by region. The accessible way into the map. */
import { fmtKm } from './format';
import type { PlacedPlace, RegionInfo } from './types';

export interface PickerGroup {
  region: RegionInfo;
  places: PlacedPlace[];
}

export function createPicker(root: HTMLElement, groups: PickerGroup[], onChoose: (p: PlacedPlace, trigger: HTMLElement) => void) {
  const q = <T extends Element>(ref: string) => root.querySelector<T>(`[data-ref="${ref}"]`)!;
  const button = q<HTMLButtonElement>('picker-button');
  const dialog = q<HTMLElement>('picker');
  const input = q<HTMLInputElement>('picker-input');
  const list = q<HTMLUListElement>('picker-list');
  let options: { li: HTMLLIElement; p: PlacedPlace }[] = [];
  let active = -1;

  function render() {
    const query = input.value.trim().toLowerCase();
    list.replaceChildren();
    options = [];
    for (const { region, places } of groups) {
      const matches = places.filter(
        (p) => !query || p.name.toLowerCase().includes(query) || region.title.toLowerCase().includes(query) || p.state.toLowerCase() === query,
      );
      if (!matches.length) continue;
      const head = document.createElement('li');
      head.className = 'picker-group tp-label';
      head.setAttribute('role', 'presentation');
      head.textContent = `${region.title} · ${region.state}`;
      list.append(head);
      for (const p of matches) {
        const li = document.createElement('li');
        li.className = 'picker-option';
        li.id = `wk-opt-${p.id}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        const name = document.createElement('span');
        name.textContent = p.name;
        const meta = document.createElement('span');
        meta.className = 'opt-meta';
        meta.textContent = `${p.state} · ${fmtKm(p.km)} km`;
        li.append(name, meta);
        li.addEventListener('click', () => choose(p));
        list.append(li);
        options.push({ li, p });
      }
    }
    if (!options.length) {
      const empty = document.createElement('li');
      empty.className = 'picker-empty';
      empty.textContent = 'No places match. Try a region name or a state, such as WA.';
      list.append(empty);
    }
    setActive(options.length ? 0 : -1);
  }

  function setActive(i: number) {
    options.forEach((o, j) => {
      o.li.classList.toggle('is-active', j === i);
      o.li.setAttribute('aria-selected', String(j === i));
    });
    active = i;
    if (i >= 0) {
      input.setAttribute('aria-activedescendant', options[i].li.id);
      options[i].li.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  const isOpen = () => dialog.classList.contains('is-open');
  function open() {
    dialog.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    input.value = '';
    render();
    input.focus();
  }
  function close(focusButton = true) {
    dialog.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus();
  }
  function choose(p: PlacedPlace) {
    close(false);
    onChoose(p, button);
  }

  button.addEventListener('click', () => (isOpen() ? close() : open()));
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (options.length) setActive((active + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length) setActive((active - 1 + options.length) % options.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) choose(options[active].p);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as Node;
    if (isOpen() && !dialog.contains(t) && !button.contains(t)) close(false);
  });

  return { isOpen, close };
}
