import React, { useMemo, useState } from "react";
import type { ProvinceConfig, DistrictConfig } from "../map3d/types";
import { openExternalWithAuthGuard } from "../auth/auth";

type Props = {
  title?: string;
  data: ProvinceConfig[];
};

function countStats(data: ProvinceConfig[]) {
  let provinceCount = data.length;
  let cityCount = 0;
  let baseCount = 0;

  for (const p of data) {
    cityCount += p.cities?.length ?? 0;
    for (const c of p.cities ?? []) {
      baseCount += c.districts?.length ?? 0;
    }
  }

  return { provinceCount, cityCount, baseCount };
}

function normalize(s: string) {
  return (s || "").trim().toLowerCase();
}

function openUrl(url?: string) {
  openExternalWithAuthGuard(url);
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

export default function DomesticConfigSidebar({ title = "基地配置", data }: Props) {
  const [q, setQ] = useState("");
  const query = normalize(q);

  const stats = useMemo(() => countStats(data), [data]);

  const filtered = useMemo(() => {
    if (!query) return data;

    return data
      .map((p) => {
        const provinceHit = normalize(p.name).includes(query);
        const cities = (p.cities ?? [])
          .map((c) => {
            const cityHit = normalize(c.name).includes(query);
            const districts: DistrictConfig[] = (c.districts ?? []).filter((d) =>
              normalize(d.name).includes(query)
            );
            if (provinceHit || cityHit || districts.length > 0) {
              return { ...c, districts: provinceHit || cityHit ? c.districts : districts };
            }
            return null;
          })
          .filter(Boolean) as ProvinceConfig["cities"];

        if (provinceHit || cities.length > 0) {
          return { ...p, cities };
        }
        return null;
      })
      .filter(Boolean) as ProvinceConfig[];
  }, [data, query]);

  return (
    <aside className="dc-sidebar" aria-label="国内基地配置">
      <div className="dc-header">
        <div className="dc-title">{title}</div>
        <div className="dc-badges">
          <span className="dc-badge">省 {stats.provinceCount}</span>
          <span className="dc-badge">市 {stats.cityCount}</span>
          <span className="dc-badge">基地 {stats.baseCount}</span>
        </div>
      </div>

      <div className="dc-search">
        <input
          className="dc-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索省 / 市 / 基地…"
        />
        {q ? (
          <button className="dc-clear" onClick={() => setQ("")} type="button">
            清空
          </button>
        ) : null}
      </div>

      <div className="dc-body">
        {filtered.length === 0 ? (
          <div className="dc-empty">没有匹配结果</div>
        ) : (
          filtered.map((p) => (
            <details key={p.name} className="dc-province" open={!query}>
              <summary className="dc-province__summary">
                <span className="dc-province__name">{p.name}</span>
                <span className="dc-province__meta">
                  {(p.cities?.length ?? 0).toString()} 城市
                </span>
              </summary>

              <div className="dc-cities">
                {(p.cities ?? []).map((c) => (
                  <div key={`${p.name}-${c.name}`} className="dc-city">
                    <div className="dc-city__top">
                      <div className="dc-city__name">{c.name}</div>
                      <div className="dc-city__actions">
                        {c.url ? (
                          <button
                            type="button"
                            className="dc-link"
                            onClick={() => openUrl(c.url)}
                            title={c.url}
                          >
                            打开城市
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="dc-districts">
                      {(c.districts ?? []).length === 0 ? (
                        <div className="dc-district dc-district--empty">暂无基地</div>
                      ) : (
                        (c.districts ?? []).map((d) => (
                          <div key={`${p.name}-${c.name}-${d.name}`} className="dc-district">
                            <div className="dc-district__name">{d.name}</div>
                            <div className="dc-district__actions">
                              {d.url ? (
                                <>
                                  <button
                                    type="button"
                                    className="dc-link"
                                    onClick={() => openUrl(d.url)}
                                    title={d.url}
                                  >
                                    打开
                                  </button>
                                  <button
                                    type="button"
                                    className="dc-ghost"
                                    onClick={() => copyToClipboard(d.url!)}
                                    title="复制链接"
                                  >
                                    复制
                                  </button>
                                </>
                              ) : (
                                <span className="dc-muted">无链接</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))
        )}
      </div>
    </aside>
  );
}


