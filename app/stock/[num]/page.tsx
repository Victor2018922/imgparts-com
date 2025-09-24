// 替换 app/stock/[num]/page.tsx 中 useEffect 里的 try/catch 代码块
try {
  const res = await fetch(FALLBACK_LIST_API, { cache: 'no-store' });
  if (!res.ok) {
    setBanner(`⚠️ 详情未携带数据且兜底失败：HTTP ${res.status}`);
    return;
  }
  const json = await res.json();
  const arr = extractArray(json);
  const found = Array.isArray(arr)
    ? arr.find((x: any) => (x?.num || x?.sku || x?.partNo || x?.code) === params.num)
    : null;

  if (found) {
    setItem({
      num: found.num || found.sku || found.partNo || found.code || params.num,
      product: found.product || found.name || 'Part',
      oe: found.oe || found.oeNo || '',
      brand: found.brand || '',
      model: found.model || '',
      year: found.year || '',
      image:
        found.image ??
        found.imgUrl ??
        found.pic ??
        found.picture ??
        found.url ??
        found.img ??
        null,
      ...found,
    });
    setBanner('ℹ️ 详情未携带数据：已从第一页兜底匹配同 num');
  } else {
    setBanner('⚠️ 详情未携带数据，且第一页未找到相同 num');
  }
} catch (e: any) {
  setBanner(`⚠️ 详情兜底异常：${e?.message || '未知错误'}`);
  setErr(e?.message || 'Load failed');
}
