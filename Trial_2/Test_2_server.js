// ============================================================
// Launchmen Task API
// Developer Candidate Test - Trial 2
// ============================================================
// Instructions:
//   Run with: npm install && node Test_2_server.js
//   Server starts on: http://localhost:3000
// ============================================================

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// BUG FIX: Serve the frontend file from the same server.
// Without this, opening the UI from a different origin can block API requests in the browser.
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'Test_2_tasks.json');

function loadTasks() {
  if (!fs.existsSync(DB_FILE)) return [];
  const raw = fs.readFileSync(DB_FILE, 'utf-8');

  // BUG FIX: Handle an empty tasks file safely.
  // Parsing an empty string throws, which would crash requests after a blank file or reset.
  if (!raw.trim()) return [];

  return JSON.parse(raw);
}

function saveTasks(tasks) {
  fs.writeFileSync(DB_FILE, JSON.stringify(tasks, null, 2));
}

// GET /tasks
// Returns all tasks. Supports optional status filter.
app.get('/tasks', (req, res) => {
  const tasks = loadTasks();
  const { status } = req.query;

  // BUG FIX: Treat an empty or whitespace-only status like no filter.
  // A blank query such as `?status=` is an edge case, and returning all tasks is the most predictable behavior.
  const normalizedStatus = typeof status === 'string' ? status.trim() : '';

  if (normalizedStatus) {
    const filtered = tasks.filter((task) => task.status === normalizedStatus);
    return res.json({ success: true, tasks: filtered });
  }

  res.json({ success: true, tasks });
});

// POST /tasks
app.post('/tasks', (req, res) => {
  const { title, status } = req.body;

  // BUG FIX: Validate that title exists before creating a task.
  // The endpoint should reject missing titles instead of saving incomplete task records.
  if (!title || !String(title).trim()) {
    return res.status(400).json({ success: false, message: 'title is required' });
  }

  const tasks = loadTasks();
  const newTask = {
    id: Date.now(),
    title: String(title).trim(),

    // BUG FIX: Default missing status values to "pending".
    // The API contract requires a valid default so new tasks are always created with a status.
    status: status ? String(status).trim() : 'pending',
  };

  tasks.push(newTask);
  saveTasks(tasks);

  // BUG FIX: Return the correct creation status code.
  // New records should respond with 201 to reflect successful creation.
  res.status(201).json({ success: true, task: newTask });
});

// PATCH /tasks/:id
app.patch('/tasks/:id', (req, res) => {
  const tasks = loadTasks();
  const { status } = req.body;

  // BUG FIX: Convert the route id to a number before comparing it.
  // Route params are strings, so strict comparison fails against numeric task ids.
  const taskId = Number(req.params.id);
  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  // BUG FIX: Require a non-empty status when updating a task.
  // Saving an empty status would replace valid task data with invalid data.
  if (!status || !String(status).trim()) {
    return res.status(400).json({ success: false, message: 'status is required' });
  }

  task.status = String(status).trim();
  saveTasks(tasks);
  res.json({ success: true, task });
});

// DELETE /tasks/:id
app.delete('/tasks/:id', (req, res) => {
  const tasks = loadTasks();

  // BUG FIX: Convert the route id to a number before searching.
  // Route params are strings, so finding by strict equality fails against numeric ids.
  const taskId = Number(req.params.id);
  const index = tasks.findIndex((task) => task.id === taskId);

  // BUG FIX: Return 404 when the task does not exist.
  // Deleting with an invalid index should not silently remove the wrong data.
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  // BUG FIX: Remove only the matched task and keep the remaining tasks array intact.
  // Assigning the result of splice replaces the full dataset with only the deleted items.
  tasks.splice(index, 1);
  saveTasks(tasks);
  res.json({ success: true, message: 'Task deleted' });
});

app.listen(3000, () => {
  console.log('Launchmen Task API running on http://localhost:3000');
});

/*
SQL PERFORMANCE ANSWERS

1. Identify the issue:
   This code has an N+1 query problem. It fetches the latest 50 posts in one query,
   then runs one extra author query per post, which means up to 51 database queries
   for a single request. It also interpolates `post.author_id` directly into SQL,
   which is unsafe compared with parameterized queries.

2. How you can fix:
   Fetch the posts and author data together with a single JOIN query, for example:

   SELECT
     posts.id,
     posts.title,
     posts.created_at,
     authors.id AS author_id,
     authors.name,
     authors.email
   FROM posts
   JOIN authors ON authors.id = posts.author_id
   ORDER BY posts.created_at DESC
   LIMIT 50;

   This removes the repeated author lookups and lets the database return everything
   in one request. If separate queries were still needed, batching author ids with
   `WHERE id IN (...)` would also be much better than querying one author at a time.
*/
