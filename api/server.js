const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const store = [];

// Compare + decorate only the fields that changed THIS submission.
// Also produces a new "base" snapshot (clean incoming values).
function decorateChanged(newVal, oldBaseVal, key = null) {
  if (key === "id") {
    return { value: oldBaseVal, base: oldBaseVal };
  }

  // Arrays
  if (Array.isArray(newVal)) {
    const oldArr = Array.isArray(oldBaseVal) ? oldBaseVal : [];
    const value = [];
    const base = [];
    for (let i = 0; i < newVal.length; i++) {
      const r = decorateChanged(newVal[i], oldArr[i], null);
      value.push(r.value);
      base.push(r.base);
    }
    return { value, base };
  }

  // Objects
  if (newVal && typeof newVal === "object") {
    const oldObj = oldBaseVal && typeof oldBaseVal === "object" ? oldBaseVal : {};
    const value = {};
    const base = {};
    for (const [k, v] of Object.entries(newVal)) {
      const r = decorateChanged(v, oldObj[k], k);
      value[k] = r.value;
      base[k] = r.base;
    }
    return { value, base };
  }

  // Primitives
  const changed = newVal !== oldBaseVal;

  if (typeof newVal === "string") {
    return {
      value: changed ? `new-${newVal}` : newVal, // remove prefix if not changed this time
      base: newVal
    };
  }

  if (typeof newVal === "number" && Number.isFinite(newVal)) {
    return {
      value: newVal,
      base: newVal
    };
  }

  // booleans, null, etc.
  return { value: newVal, base: newVal };
}

function upsertById(incoming) {
  const idx = store.findIndex((x) => x.id === incoming.id);
  const now = Date.now();

  // CREATE: no decoration at all
  if (idx === -1) {
    const created = {
      ...incoming,
      number: 1,
      updatedAt: now,
      __base: { ...incoming } // internal clean snapshot
    };
    store.push(created);
    return { action: "created", record: created };
  }

  // UPDATE: decorate only changed fields vs last clean snapshot
  const existing = store[idx];
  const oldBase = existing.__base || {};

  const r = decorateChanged(incoming, oldBase);
  const updated = {
    ...existing,
    ...r.value,
    id: existing.id,                 // hard-lock id
    number: (existing.number || 1) + 1,
    updatedAt: now,
    __base: r.base                   // replace clean snapshot
  };

  store[idx] = updated;
  return { action: "updated", record: updated };
}

app.post("/items", (req, res) => {
  const { id, name, price, tags } = req.body || {};

  // minimal validation
  if (
    !id?.trim() ||
    !name?.trim() ||
    !Number.isFinite(price) ||
    !Array.isArray(tags) ||
    tags.length === 0
  ) {
    return res.status(400).json({ error: "Invalid payload." });
  }

  const incoming = {
    ...req.body,
    id: id.trim(),
    name: name.trim()
  };

  const result = upsertById(incoming);

  // If you don't want __base to show up in responses, hide it here:
  const publicStore = store.map(({ __base, ...rest }) => rest);
  const publicRecord = (({ __base, ...rest }) => rest)(result.record);

  res.status(201).json({ ...result, record: publicRecord, store: publicStore });
});

app.get("/items", (req, res) => {
  const publicStore = store.map(({ __base, ...rest }) => rest);
  res.json(publicStore);
});

app.listen(3000, () => console.log("API running on http://localhost:3000"));
