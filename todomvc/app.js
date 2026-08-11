import { h, createApp, createRouter } from '../framework/index.js';

// ---------------------------------------------------------------------
// Persistence — plain localStorage, nothing framework-specific. Every
// reference TodoMVC implementation keeps your todos across refreshes,
// so we do too. The framework itself has no idea this exists.
// ---------------------------------------------------------------------
const STORAGE_KEY = 'mini-framework-todomvc';

function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTodos(todos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

let nextId = 1;
function makeId() {
  return String(nextId++);
}

// ---------------------------------------------------------------------
// App
// ---------------------------------------------------------------------
const app = createApp({
  state: {
    todos: loadTodos(),
    filter: 'all', // "all" | "active" | "completed" — driven by the router
    editingId: null, // id of the todo currently being double-click-edited
  },
  view,
});

// keep localStorage in sync with every todos change (filter/editingId
// don't need persisting — they're just current UI state)
let lastTodosRef = null;

function persistIfTodosChanged(state) {
  if (state.todos !== lastTodosRef) {
    lastTodosRef = state.todos;
    saveTodos(state.todos);
  }
}

// ---------------------------------------------------------------------
// Actions — small named functions instead of inline logic everywhere,
// so the view stays readable and the state transitions are easy to find.
// ---------------------------------------------------------------------
function addTodo(title) {
  const trimmed = title.trim();
  if (!trimmed) return;
  app.setState(s => ({
    todos: [...s.todos, { id: makeId(), title: trimmed, completed: false }],
  }));
}

function toggleTodo(id) {
  app.setState(s => ({
    todos: s.todos.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)),
  }));
}

function toggleAll(completed) {
  app.setState(s => ({
    todos: s.todos.map(t => ({ ...t, completed })),
  }));
}

function destroyTodo(id) {
  app.setState(s => ({ todos: s.todos.filter(t => t.id !== id) }));
}

function clearCompleted() {
  app.setState(s => ({ todos: s.todos.filter(t => !t.completed) }));
}

function startEditing(id) {
  app.setState({ editingId: id });
}

function commitEdit(id, title) {
  const trimmed = title.trim();
  if (!trimmed) {
    destroyTodo(id); // saving an edit to empty text removes the todo (spec behavior)
  } else {
    app.setState(s => ({
      todos: s.todos.map(t => (t.id === id ? { ...t, title: trimmed } : t)),
    }));
  }
  app.setState({ editingId: null });
}

function cancelEdit() {
  app.setState({ editingId: null });
}

// ---------------------------------------------------------------------
// View — pure function: state in, VNode tree out. This is what makes
// the diffing in Step 7 possible: we always describe the WHOLE UI for
// the current state, and the framework figures out what actually
// changed in the real DOM.
// ---------------------------------------------------------------------
function visibleTodos(state) {
  if (state.filter === 'active') return state.todos.filter(t => !t.completed);
  if (state.filter === 'completed') return state.todos.filter(t => t.completed);
  return state.todos;
}

function todoItem(todo, state) {
  const isEditing = state.editingId === todo.id;

  return h(
    'li',
    { class: [todo.completed && 'completed', isEditing && 'editing'].filter(Boolean).join(' ') },
    [
      h('div', { class: 'view' }, [
        h('input', {
          class: 'toggle',
          type: 'checkbox',
          checked: todo.completed,
          onChange: () => toggleTodo(todo.id),
        }),
        h('label', { onDblclick: () => startEditing(todo.id) }, [todo.title]),
        h('button', { class: 'destroy', onClick: () => destroyTodo(todo.id) }),
      ]),
      h('input', {
        class: 'edit',
        value: todo.title,
        onKeydown: e => {
          if (e.key === 'Enter') e.target.blur(); // triggers onBlur -> commitEdit
          if (e.key === 'Escape') cancelEdit();
        },
        onBlur: e => {
          if (isEditing) commitEdit(todo.id, e.target.value);
        },
      }),
    ]
  );
}

function filterLink(state, filterName, path, label) {
  return h('li', {}, [
    h(
      'a',
      {
        class: state.filter === filterName ? 'selected' : '',
        href: path,
        onClick: e => {
          e.preventDefault();
          router.navigate(path);
        },
      },
      [label]
    ),
  ]);
}

function view(state) {
  persistIfTodosChanged(state);

  const todos = state.todos;
  const shown = visibleTodos(state);
  const activeCount = todos.filter(t => !t.completed).length;
  const completedCount = todos.length - activeCount;
  const hasTodos = todos.length > 0;

  return h(
    'section',
    { class: 'todoapp' },
    [
      h('header', { class: 'header' }, [
        h('h1', {}, ['todos']),
        h('input', {
          class: 'new-todo',
          placeholder: 'What needs to be done?',
          autofocus: true,
          value: '',
          onKeydown: e => {
            if (e.key === 'Enter') {
              addTodo(e.target.value);
              e.target.value = '';
            }
          },
        }),
      ]),

      hasTodos &&
        h('section', { class: 'main' }, [
          h('input', {
            id: 'toggle-all',
            class: 'toggle-all',
            type: 'checkbox',
            checked: activeCount === 0,
            onChange: e => toggleAll(e.target.checked),
          }),
          h('label', { for: 'toggle-all' }, ['Mark all as complete']),
          h(
            'ul',
            { class: 'todo-list' },
            shown.map(todo => todoItem(todo, state))
          ),
        ]),

      hasTodos &&
        h('footer', { class: 'footer' }, [
          h('span', { class: 'todo-count' }, [
            h('strong', {}, [String(activeCount)]),
            ` item${activeCount === 1 ? '' : 's'} left`,
          ]),
          h('ul', { class: 'filters' }, [
            filterLink(state, 'all', '/', 'All'),
            filterLink(state, 'active', '/active', 'Active'),
            filterLink(state, 'completed', '/completed', 'Completed'),
          ]),
          completedCount > 0 &&
            h('button', { class: 'clear-completed', onClick: clearCompleted }, ['Clear completed']),
        ]),
    ].filter(Boolean)
  );
}

// ---------------------------------------------------------------------
// Routing — "/", "/active", "/completed" map directly to state.filter.
// We use real History API paths (not "#/active") since that's the
// routing style our framework implements (see framework/router.js).
// ---------------------------------------------------------------------
const router = createRouter({
  '/': () => app.setState({ filter: 'all' }),
  '/active': () => app.setState({ filter: 'active' }),
  '/completed': () => app.setState({ filter: 'completed' }),
});

app.mount('#app');
router.start();
