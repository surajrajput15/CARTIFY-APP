// Admin flow QA
const BASE = 'http://localhost:5000';
const TS = 1785818041;
const EMAIL = `qaadmin1785818041@test.com`;
const report = [];
let pass = 0, fail = 0;

const req = async (method, path, { token, body, form } = {}) => {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let b;
  if (form) { b = form; }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; b = JSON.stringify(body); }
  headers['X-Forwarded-For'] = `8.${Math.random()*250|0}.${Math.random()*250|0}.${Math.random()*250|0}`;
  const res = await fetch(BASE + path, { method, headers, body: b });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
};
const check = (n, c, d) => { report.push(`[${c?'PASS':'FAIL'}] ${n}${d?` :: ${d}`:''}`); c?pass++:fail++; };
const real = (n, r) => report.push(`[REAL:${r.status}] ${n} :: ${typeof r.json === 'string' ? r.json : JSON.stringify(r.json).slice(0,180)}`);

const run = async () => {
  // admin user: registered+promoted outside (makeAdmin)
  // create a fresh one here to be safe (may be already admin via script with same email if TS same-second)
  let r = await req('POST', '/api/auth/login', { body: { email: EMAIL, password: 'admin1234' } });
  let ADMIN = r.json?.token;
  if (!ADMIN) { // fallback: promote here via re-register attempt
    await req('POST', '/api/auth/register', { body: { name: 'QA Admin', email: EMAIL, password: 'admin1234' } });
    r = await req('POST', '/api/auth/login', { body: { email: EMAIL, password: 'admin1234' } });
    ADMIN = r.json?.token;
  }
  check('admin login ok', !!ADMIN);

  // non-admin token for 403 tests
  const userEmail = `qaplain1785818041@test.com`;
  await req('POST', '/api/auth/register', { body: { name: 'Plain', email: userEmail, password: 'pass1234' } });
  const lr = await req('POST', '/api/auth/login', { body: { email: userEmail, password: 'pass1234' } });
  const USERTOKEN = lr.json?.token;

  // product add
  r = await req('POST', '/api/products/add', { token: USERTOKEN, body: { title: 'x', price: 1 } });
  check('product add as non-admin -> 403', r.status === 403);
  const newProd = { title: `QA Product ${TS}`, description: 'QA test product for end-to-end verification.', price: 499.99, category: 'electronics', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80', rating: { rate: 4.2, count: 33 } };
  r = await req('POST', '/api/products/add', { token: ADMIN, body: newProd });
  check('product add as admin 201', r.status === 201);
  const PID = r.json?.product?._id;
  real('added product', r);

  // validation cases
  r = await req('POST', '/api/products/add', { token: ADMIN, body: { title: 'Bad', price: -5, description: 'd', category: 'x', image: 'img' } });
  check('product add negative price -> 400', r.status === 400);
  r = await req('POST', '/api/products/add', { token: ADMIN, body: { title: 'No price', description: 'd', category: 'x', image: 'img' } });
  check('product add missing price -> 400', r.status === 400);

  // patch
  r = await req('PATCH', `/api/products/${PID}`, { token: ADMIN, body: { price: 599.5, title: 'QA Product Updated' } });
  check('patch product 200', r.status === 200 && r.json?.product?.price === 599.5);
  r = await req('PATCH', `/api/products/${PID}`, { token: ADMIN, body: { countInStock: 5 } });
  real('patch countInStock (field missing in schema)', r);
  check('patch countInStock applied (stock field exists)', r.json?.product?.countInStock === 5);

  // invalid id handling
  r = await req('PATCH', '/api/products/notanid', { token: ADMIN, body: { price: 1 } });
  real('patch invalid id', r);
  r = await req('DELETE', '/api/products/notanid', { token: ADMIN });
  real('delete invalid id', r);

  // search via admin list
  r = await req('GET', '/api/products?search=QA%20Product&limit=100');
  check('admin search finds created product', r.status === 200 && (r.json?.products||[]).some(p=>p._id===PID));

  // seed + clear
  r = await req('POST', '/api/products/seed', { token: ADMIN, body: [{ title: 'Seed One', price: 10, description: 'd', category: 'Men', image: 'img' }] });
  real('seed endpoint', r);
  check('seed returns 201', r.status === 201);

  // IMAGE UPLOAD (real file)
  const fs = await import('fs');
  const fileBuf = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082', 'hex');
  const fd = new FormData();
  fd.append('image', new Blob([fileBuf], { type: 'image/png' }), 'test.png');
  const up = await fetch(BASE + '/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${ADMIN}` }, body: fd });
  const upText = await up.text();
  let upJson; try { upJson = JSON.parse(upText); } catch { upJson = upText; }
  report.push(`[REAL:${up.status}] image upload :: ${JSON.stringify(upJson).slice(0,200)}`);
  check('image upload works (2xx)', up.status === 200 || up.status === 201);
  const imgPath = upJson?.image;
  if (imgPath) {
    const g = await fetch(BASE + imgPath);
    report.push(`[REAL:${g.status}] GET uploaded image (${imgPath}) :: persisted?`);
    check('uploaded image retrievable', g.status === 200);
  }

  // cleanup: delete the created product (restore DB)
  if (PID) { const d = await req('DELETE', `/api/products/${PID}`, { token: ADMIN }); real('cleanup delete product', d); }

  console.log(report.join('\n'));
  console.log(`\n===== ADMIN SUMMARY: PASS=${pass} FAIL=${fail} =====`);
};
run().catch(e => { console.error('ERR', e); process.exit(1); });
