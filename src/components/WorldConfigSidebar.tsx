import React, { useMemo, useState } from "react";
import type { ProjectionFnParamType } from "../map3d/types";
import type { WorldCountryConfig } from "../map3d/mapConfig";
import { openExternalWithAuthGuard } from "../auth/auth";

type Props = {
  title?: string;
  data: WorldCountryConfig[];
  projection: ProjectionFnParamType;
};

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

export default function WorldConfigSidebar({
  title = "海外配置",
  data,
  projection,
}: Props) {
  const [q, setQ] = useState("");
  const query = normalize(q);

  const stats = useMemo(() => {
    const countryCount = data.length;
    let cityCount = 0;
    let baseCount = 0;
    data.forEach((country) => {
      cityCount += country.cities?.length ?? 0;
      country.cities?.forEach((c) => {
        baseCount += c.districts?.length ?? 0;
      });
    });
    return { countryCount, cityCount, baseCount };
  }, [data]);

  const filtered = useMemo(() => {
    if (!query) return data;
    return data
      .map((country) => {
        const countryHit = normalize(country.name).includes(query);
        const cities = (country.cities ?? [])
          .map((c) => {
            const cityHit = normalize(c.name).includes(query);
            const districts =
              c.districts?.filter((d) => normalize(d.name).includes(query)) ??
              [];
            if (countryHit || cityHit || districts.length > 0) {
              return {
                ...c,
                districts: countryHit || cityHit ? c.districts : districts,
              };
            }
            return null;
          })
          .filter(Boolean) as WorldCountryConfig["cities"];

        if (countryHit || cities.length > 0) {
          return { ...country, cities };
        }
        return null;
      })
      .filter(Boolean) as WorldCountryConfig[];
  }, [data, query]);

  return (
    <aside className="dc-sidebar" aria-label="海外基地配置">
      <div className="dc-header">
        <div className="dc-title">{title}</div>
        <div className="dc-badges">
          <span className="dc-badge">国家 {stats.countryCount}</span>
          <span className="dc-badge">城市 {stats.cityCount}</span>
          <span className="dc-badge">基地 {stats.baseCount}</span>
        </div>
      </div>

      <div className="dc-search">
        <input
          className="dc-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索国家 / 城市 / 基地…"
        />
        {q ? (
          <button className="dc-clear" onClick={() => setQ("")} type="button">
            清空
          </button>
        ) : null}
      </div>

      <div className="dc-body">
        <div className="dc-province" style={{ marginBottom: 12 }}>
          <div className="dc-province__summary" style={{ cursor: "default" }}>
            <span className="dc-province__name">投影参数</span>
            <span className="dc-province__meta">
              center: [{projection.center.join(", ")}] · scale: {projection.scale}
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="dc-empty">没有匹配结果</div>
        ) : (
          filtered.map((country) => (
            <details key={country.name} className="dc-province" open={!query}>
              <summary className="dc-province__summary">
                <span className="dc-province__name">{country.name}</span>
                <span className="dc-province__meta">
                  {(country.cities?.length ?? 0).toString()} 城市
                </span>
              </summary>

              <div className="dc-cities">
                {(country.cities ?? []).map((c) => (
                  <div key={`${country.name}-${c.name}`} className="dc-city">
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
                        (c.districts ?? []).map((d, idx) => (
                          <div
                            key={`${country.name}-${c.name}-${d.name}-${idx}`}
                            className="dc-district"
                          >
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

