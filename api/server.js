const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const store = [];

function compareChange(newVal, oldBaseVal, key = null) {
  if (key === "id") {
    return { value: oldBaseVal, base: oldBaseVal };
  }

  if (Array.isArray(newVal)) {
    const oldArr = Array.isArray(oldBaseVal) ? oldBaseVal : [];
    const value = [];
    const base = [];
    for (let i = 0; i < newVal.length; i++) {
      const r = compareChange(newVal[i], oldArr[i], null);
      value.push(r.value);
      base.push(r.base);
    }
    return { value, base };
  }

  if (newVal && typeof newVal === "object") {
    const oldObj = oldBaseVal && typeof oldBaseVal === "object" ? oldBaseVal : {};
    const value = {};
    const base = {};
    for (const [k, v] of Object.entries(newVal)) {
      const r = compareChange(v, oldObj[k], k);
      value[k] = r.value;
      base[k] = r.base;
    }
    return { value, base };
  }

  const changed = newVal !== oldBaseVal;

  if (typeof newVal === "string") {
    return {
      value: changed ? `new-${newVal}` : newVal,
      base: newVal
    };
  }

    if (typeof newVal === "number" && Number.isFinite(newVal)) {
    return {
      value: newVal,
      base: newVal
    };
  }

  return { value: newVal, base: newVal };
}

function findById(incoming) {
  const idx = store.findIndex((x) => x.id === incoming.id);
  const now = Date.now();

  if (idx === -1) {
    const created = {
      ...incoming,
      number: 1,
      updatedAt: now,
      __base: { ...incoming }
    };
    store.push(created);
    return { action: "created", record: created };
  }

  const existing = store[idx];
  const oldBase = existing.__base || {};

  const r = compareChange(incoming, oldBase);
  const updated = {
    ...existing,
    ...r.value,
    id: existing.id,
    number: (existing.number || 1) + 1,
    updatedAt: now,
    __base: r.base
  };

  store[idx] = updated;
  return { action: "updated", record: updated };
}

app.post("/items", (req, res) => {
  const { id, name, price, tags } = req.body || {};

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

  const result = findById(incoming);

  const publicStore = store.map(({ __base, ...rest }) => rest);
  const publicRecord = (({ __base, ...rest }) => rest)(result.record);

  res.status(201).json({ ...result, record: publicRecord, store: publicStore });
});

app.get("/items", (req, res) => {
  const publicStore = store.map(({ __base, ...rest }) => rest);
  res.json(publicStore);
});

app.listen(3000, () => console.log("API running on http://localhost:3000"));
