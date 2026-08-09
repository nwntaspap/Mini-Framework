/**
 * h(tag, attrs, children)
 *
 * Builds a "VNode" — a plain JS object describing a piece of UI.
 * It does NOT touch the real DOM. That's on purpose: h() only
 * describes *what* the UI should look like, some other part of
 * the framework (dom.js's createDOMElement)
 * will be responsible for turning that description into real
 * DOM nodes.
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
