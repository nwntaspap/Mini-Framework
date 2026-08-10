import { setEventHandler } from './events.js';

/**
 * h(tag, attrs, children)
 *
 * Builds a "VNode" — a plain JS object describing a piece of UI.
 * It does NOT touch the real DOM. That's on purpose: h() only
 * describes *what* the UI should look like, some other part of
 * the framework (dom.js's createDOMElement) will be responsible
 * for turning that description into real DOM nodes.
 *
 * @param {string} tag - html tag name, e.g. "div", "input", "span"
 * @param {object} attrs - attributes/props, e.g. { class: "todo", id: "x" }
 *                         event handlers go here too, e.g. { onClick: fn }
 * @param {Array<VNode|string>} children - nested VNodes or plain strings (text nodes)
 * @returns {VNode}
 */
export function h(tag, attrs = {}, children = []) {
  return {
    tag,
    attrs: attrs || {},
    // allow h("div", {}, "just text") as a shorthand
    children: Array.isArray(children) ? children : [children],
  };
}

// Properties that must be set directly on the DOM node (el.checked = true)
// instead of via setAttribute. Without this, things like checkboxes and
// inputs won't reflect state changes correctly after the first render.
const DOM_PROPERTIES = new Set(['value', 'checked', 'disabled', 'selected']);

/**
 * Turns a single VNode (or text string) into a real DOM node.
 * This is recursive: it builds the element, then builds and appends
 * every child, all the way down to text nodes.
 *
 * @param {VNode|string} vnode
 * @returns {Node} a real DOM Node
 */
export function createDOMElement(vnode) {
  // text nodes are just plain strings in our VNode tree
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return document.createTextNode(String(vnode));
  }

  const el = document.createElement(vnode.tag);

  for (const [key, value] of Object.entries(vnode.attrs || {})) {
    if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase(); // "onClick" -> "click"
      // our own event system from events.js
      setEventHandler(el, eventName, value);
    } else if (DOM_PROPERTIES.has(key)) {
      el[key] = value;
    } else {
      el.setAttribute(key, value);
    }
  }

  for (const child of vnode.children || []) {
    el.appendChild(createDOMElement(child));
  }

  return el;
}

/**
 * Renders a VNode tree into a real DOM container.
 * Clears the container first, then mounts fresh.
 *
 * @param {VNode} vnode
 * @param {HTMLElement} container - a real DOM element already on the page
 */
export function mount(vnode, container) {
  container.innerHTML = '';
  container.appendChild(createDOMElement(vnode));
}
