/**
 * JSON-only collection API installed on the iframe bridge. Published apps can
 * switch to the cloud-private parent transport; shared data stays false.
 * It deliberately exposes no network, credentials or arbitrary callbacks.
 * Mutations are serialized per collection so Promise.all cannot lose writes
 * inside one generated runtime.
 */
export const FENIX_DATA_API_RUNTIME = String.raw`
  var dataLanes = Object.create(null);
  var dataRuntimeMode = "local-first";
  var dataTokenRe = /^[A-Za-z0-9._-]{1,80}$/;
  var dataForbidden = { "__proto__": 1, "prototype": 1, "constructor": 1 };
  function dataToken(value, label){
    var token = String(value == null ? "" : value);
    if (!dataTokenRe.test(token) || dataForbidden[token]) throw new Error("Fenix.data: " + label + " non valido");
    return token;
  }
  function dataClone(value){
    var json = JSON.stringify(value, function(key, item){
      if (dataForbidden[key]) throw new Error("Fenix.data: campo riservato");
      if (typeof item === "function" || typeof item === "symbol" || typeof item === "bigint") {
        throw new Error("Fenix.data: sono ammessi solo dati JSON");
      }
      return item;
    });
    if (json == null) throw new Error("Fenix.data: dato JSON richiesto");
    return JSON.parse(json);
  }
  function dataRecord(value, label){
    var row = dataClone(value);
    if (!row || Object.prototype.toString.call(row) !== "[object Object]") {
      throw new Error("Fenix.data: " + label + " deve essere un oggetto");
    }
    return row;
  }
  function dataRows(value){
    var rows = value && value._fenix === 1 && Array.isArray(value.items) ? value.items : value;
    if (rows == null) return [];
    if (!Array.isArray(rows)) throw new Error("Fenix.data: la collezione non contiene righe");
    return dataClone(rows);
  }
  function dataId(value){ return dataToken(value, "id"); }
  function dataNewId(){
    try { if (crypto && typeof crypto.randomUUID === "function") return "d_" + crypto.randomUUID(); } catch (e) {}
    return "d_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }
  function dataLane(col, work){
    var prior = dataLanes[col] || Promise.resolve();
    var next = prior.then(work, work);
    dataLanes[col] = next.then(function(){}, function(){});
    return next;
  }
  function dataLoad(col){
    col = dataToken(col, "collezione");
    return Promise.resolve(api.load(col)).then(dataRows);
  }
  function dataSave(col, rows){
    return Promise.resolve(api.save(col, rows)).then(function(ack){
      if (ack === false || (ack && typeof ack === "object" && ack.ok === false)) {
        throw new Error("Fenix.data: salvataggio non confermato");
      }
      return rows;
    });
  }
  function dataEqual(a, b){
    if (a === b) return true;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }
  function dataMatches(row, where){
    if (!where) return true;
    var filter = dataRecord(where, "filtro");
    return Object.keys(filter).every(function(key){ return dataEqual(row && row[key], filter[key]); });
  }
  function dataQuery(col, options){
    options = options && typeof options === "object" ? dataClone(options) : {};
    return dataLoad(col).then(function(rows){
      var out = rows.filter(function(row){ return dataMatches(row, options.where); });
      if (options.orderBy) {
        var field = dataToken(options.orderBy, "ordinamento");
        var direction = options.direction === "desc" ? -1 : 1;
        out.sort(function(a, b){
          var av = a && a[field]; var bv = b && b[field];
          if (av === bv) return 0;
          return (av == null ? 1 : bv == null ? -1 : String(av).localeCompare(String(bv), "it", { numeric: true })) * direction;
        });
      }
      var offset = Math.max(0, Math.floor(Number(options.offset) || 0));
      var limit = Math.min(500, Math.max(0, Math.floor(Number(options.limit == null ? 500 : options.limit) || 0)));
      return out.slice(offset, offset + limit);
    });
  }
  function dataGet(col, id){
    id = dataId(id);
    return dataLoad(col).then(function(rows){
      var found = rows.find(function(row){ return row && String(row.id) === id; });
      return found ? dataClone(found) : null;
    });
  }
  function dataInsert(col, value){
    col = dataToken(col, "collezione");
    var row = dataRecord(value, "riga");
    row.id = row.id == null || row.id === "" ? dataNewId() : dataId(row.id);
    return dataLane(col, function(){
      return dataLoad(col).then(function(rows){
        if (rows.some(function(item){ return item && String(item.id) === row.id; })) {
          throw new Error("Fenix.data: id gia presente");
        }
        rows.push(row);
        return dataSave(col, rows).then(function(){ return dataClone(row); });
      });
    });
  }
  function dataUpdate(col, id, changes){
    col = dataToken(col, "collezione"); id = dataId(id);
    var patch = dataRecord(changes, "modifica");
    if (patch.id != null && String(patch.id) !== id) throw new Error("Fenix.data: id immutabile");
    delete patch.id;
    return dataLane(col, function(){
      return dataLoad(col).then(function(rows){
        var index = rows.findIndex(function(row){ return row && String(row.id) === id; });
        if (index < 0) return null;
        rows[index] = Object.assign({}, rows[index], patch, { id: id });
        return dataSave(col, rows).then(function(){ return dataClone(rows[index]); });
      });
    });
  }
  function dataRemove(col, id){
    col = dataToken(col, "collezione"); id = dataId(id);
    return dataLane(col, function(){
      return dataLoad(col).then(function(rows){
        var next = rows.filter(function(row){ return !row || String(row.id) !== id; });
        if (next.length === rows.length) return false;
        return dataSave(col, next).then(function(){ return true; });
      });
    });
  }
  api.data = Object.freeze({
    get mode(){ return dataRuntimeMode; },
    shared: false,
    query: dataQuery,
    list: dataQuery,
    get: dataGet,
    insert: dataInsert,
    update: dataUpdate,
    remove: dataRemove
  });
`;
