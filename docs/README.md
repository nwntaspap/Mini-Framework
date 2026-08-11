# mini-framework

A small JavaScript framework built entirely from scratch — no React, Vue,
Angular, or any other high-level library. It implements the four pillars
any front-end framework needs:

- **DOM abstraction** — describe UI as plain JS objects (VNodes), the
  framework turns them into real DOM nodes and keeps them in sync.
- **State management** — a small observable store; update state, the UI
  re-renders automatically.
- **Routing** — synchronizes the URL with your app's state using the
  History API.
- **Event handling** — your own event system, built on event
  delegation, not a thin wrapper around `addEventListener`.

It ships as ES modules with **zero build step** — no bundler, no
compiler, nothing to `npm install` to run it.

## Running a project built with this framework

Because the framework uses real ES module imports (`import ... from
"../framework/index.js"`), you need a **static file server** — you can't
just double-click an `index.html` (browsers block ES module imports over
the `file://` protocol).

From the **root of this repository** (the folder containing `framework/`
and `todomvc/`), run any static server, for example:

```bash
python -m http.server
```

Then open:

```
http://localhost:8000/todomvc/
```

Running the server from `todomvc/` itself will **not** work — the
TodoMVC app imports the framework from a sibling folder
(`../framework/index.js`), so the server's root must be high enough to
see both folders.

## Folder structure

```
mini-framework/
├── framework/          the framework itself
│   ├── index.js          public API — the only file you should import from
│   ├── dom.js             h(), VNode → real DOM, diffing (internal)
│   ├── state.js           createStore (internal, re-exported via index.js)
│   ├── events.js          event delegation (internal)
│   ├── router.js          createRouter
│   └── app.js             createApp — ties state + view + DOM together
├── todomvc/             example app built with the framework
└── docs/
    └── README.md         this file
```

---

## Core concepts

### 1. Creating an element — `h()`

`h(tag, attrs, children)` builds a **VNode**: a plain JavaScript object
describing a piece of UI. It does **not** touch the real DOM — it's just
a description.

```js
import { h } from '../framework/index.js';

const vnode = h('div', { class: 'box' });
```

This produces (internally):

```js
{ tag: "div", attrs: { class: "box" }, children: [] }
```

### 2. Adding attributes

Attributes go in the second argument, as a plain object:

```js
h('input', {
  type: 'text',
  placeholder: 'What needs to be done?',
  id: 'new-todo',
});
```

A few attribute names are handled specially:

- **`onX` (e.g. `onClick`, `onInput`, `onKeydown`)** — registers an
  event handler, see [Creating an event](#3-creating-an-event) below.
- **`value`, `checked`, `disabled`, `selected`** — set as real DOM
  _properties_ (`el.checked = true`) instead of HTML attributes, because
  that's what actually keeps checkboxes/inputs correctly in sync after
  the first render.
- everything else (`class`, `id`, `type`, `placeholder`, `href`, ...) is
  set with `setAttribute`.

### 3. Creating an event

Event handlers are just functions passed as `onX` attributes:

```js
h(
  'button',
  {
    onClick: () => console.log('clicked!'),
  },
  ['Save']
);
```

Under the hood this does **not** call `element.addEventListener(...)`
for every element. Instead, the framework uses **event delegation**: one
real listener per event _type_ is attached once on the app's root
container; when an event fires, the framework walks up from
`event.target` to find the closest element with a matching registered
handler.

Why this matters:

- elements created _later_ (e.g. a new todo `<li>`) automatically get
  working event handlers, with zero extra wiring
- there are only ever a handful of real browser listeners, no matter how
  many interactive elements are on the page

This is a deliberately different mechanism than directly wrapping
`addEventListener`, as required by the project spec.

### 4. Nesting elements

The third argument to `h()` is an array of children — each child can be
another `h(...)` call (an element) or a plain string (a text node):

```js
h('div', { class: 'todo' }, [
  h('input', { type: 'checkbox' }),
  h('label', {}, ['Buy milk']),
  h('button', { class: 'destroy' }),
]);
```

Nesting is just nesting function calls — there's no special syntax to
learn.

---

## How the framework works

### The overall flow

```
User interacts (click, type, ...)
        │
        ▼
   Event system (delegation)
        │
        ▼
   your handler calls setState()
        │
        ▼
       Store
        │
   notifies subscribers
        │
        ▼
   view(state)  →  new VNode tree
        │
        ▼
   patch(oldVNode, newVNode)
        │
        ▼
     Real DOM updated (only what changed)
```

You never call a "render" function yourself — you just describe **what
the state is** and **what the UI should look like for a given state**.
The framework decides _when_ to actually re-render. This inversion of
control (the framework calls your code, not the other way around) is
what makes it a framework rather than a library.

### `createApp` — wiring it all together

```js
import { h, createApp } from '../framework/index.js';

const app = createApp({
  state: { count: 0 },
  view: state =>
    h('div', {}, [
      h('span', {}, [String(state.count)]),
      h('button', { onClick: () => app.setState(s => ({ count: s.count + 1 })) }, ['+1']),
    ]),
});

app.mount('#app');
```

- `state` — the initial state.
- `view(state)` — a **pure function**: given a state, return a VNode
  tree. It's called automatically every time the state changes.
- `app.setState(partial)` — updates the state (shallow-merged) and
  triggers a re-render. Accepts either an object or a function
  `(prevState) => partialState` (useful when the update depends on the
  previous state).
- `app.mount(selector)` — mounts the app into a real DOM element.

### Diffing — why re-renders are cheap

Every state change re-runs the _entire_ `view(state)` function, but the
framework does **not** throw away and rebuild the whole DOM each time.
Instead, it keeps the previous VNode tree around and compares it to the
new one (`patch()` in `framework/dom.js`):

- a node that didn't exist before → created
- a node that no longer exists → removed
- a node with a different tag → replaced
- a node with the same tag → its attributes are updated in place, and
  its children are diffed recursively

This means unrelated parts of the UI are left completely untouched on
every render — only what actually changed gets touched in the real DOM.

> Note: children are compared by their position in the list (index-based
> diffing), not by a stable identity ("key"). This is simpler and is
> enough for this project, but it means reordering a list can cause more
> DOM changes than a keyed algorithm (like React's) would. Worth knowing
> if you ever see more DOM churn than expected on a reordering.

### State management — `createStore`

`createApp` uses a small observable store internally
(`framework/state.js`), also usable on its own:

```js
import { createStore } from '../framework/index.js';

const store = createStore({ todos: [] });

store.subscribe(state => console.log('state changed:', state));

store.setState({ todos: [...store.getState().todos, 'new item'] });
```

- `getState()` — read the current state.
- `setState(update)` — shallow-merges `update` into the state and
  notifies every subscriber. `update` can be an object or a function.
- `subscribe(listener)` — called with the new state on every change.
  Returns an unsubscribe function.

It's intentionally simple — no actions, no reducers, no middleware. Just
enough to keep multiple parts of an app in sync with a single source of
truth.

### Routing — `createRouter`

The router synchronizes the browser URL with your app, using the real
History API (`pushState` / `popstate`) — not hash-based routing
(`#/active`).

```js
import { createRouter } from '../framework/index.js';

const router = createRouter({
  '/': () => app.setState({ filter: 'all' }),
  '/active': () => app.setState({ filter: 'active' }),
  '/completed': () => app.setState({ filter: 'completed' }),
});

router.start(); // reacts to the current URL, and to back/forward
router.navigate('/active'); // called from a click handler — changes the URL
```

- `router.start()` — call once, when the app starts. Runs the handler
  matching the current URL, and listens for the browser's back/forward
  buttons (`popstate`) so those work correctly too.
- `router.navigate(path)` — changes the URL (no page reload) and runs
  the matching handler. Use this instead of a plain `<a href>` navigation
  in your click handlers.

The router holds **no state of its own** — it only translates a URL into
a function call. What a route _means_ (which filter, which page) is
entirely up to the handler you provide, usually a `setState()` call.

### Application-level events — `on` / `off` / `emit`

Separate from DOM events, the framework also exposes a tiny pub/sub for
custom application events — not needed for TodoMVC, but useful for
apps with events that aren't tied to a specific DOM element (e.g. a
`"playerMoved"` event in a game):

```js
import { on, emit } from '../framework/index.js';

on('playerMoved', position => console.log('moved to', position));
emit('playerMoved', { x: 3, y: 4 });
```

---

## Example: TodoMVC

The `todomvc/` folder is a complete, functional TodoMVC implementation
built entirely on this framework — see it for a full real-world example
covering all four pillars together (adding/editing/removing todos,
filtering by URL, and a shared store for the todo list, counter, and
footer).
