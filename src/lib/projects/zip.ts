function crc32(data: Uint8Array) {
  let c = ~0 >>> 0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function u16(n: number) {
  const b = new Uint8Array(2);
  b[0] = n & 255;
  b[1] = (n >>> 8) & 255;
  return b;
}

function u32(n: number) {
  const b = new Uint8Array(4);
  b[0] = n & 255;
  b[1] = (n >>> 8) & 255;
  b[2] = (n >>> 16) & 255;
  b[3] = (n >>> 24) & 255;
  return b;
}

export function zipFiles(files: { path: string; content: string }[]) {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = enc.encode(file.path.replace(/^\/+/, ""));
    const body = enc.encode(file.content);
    const crc = crc32(body);
    const local = new Uint8Array(30 + name.length + body.length);
    local.set([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    local.set(u32(crc), 14);
    local.set(u32(body.length), 18);
    local.set(u32(body.length), 22);
    local.set(u16(name.length), 26);
    local.set(name, 30);
    local.set(body, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    central.set([0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    central.set(u32(crc), 16);
    central.set(u32(body.length), 20);
    central.set(u32(body.length), 24);
    central.set(u16(name.length), 28);
    central.set(u32(offset), 42);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  end.set([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0]);
  end.set(u16(files.length), 8);
  end.set(u16(files.length), 10);
  end.set(u32(centralSize), 12);
  end.set(u32(offset), 16);

  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of locals) {
    out.set(part, p);
    p += part.length;
  }
  for (const part of centrals) {
    out.set(part, p);
    p += part.length;
  }
  out.set(end, p);
  return out;
}
