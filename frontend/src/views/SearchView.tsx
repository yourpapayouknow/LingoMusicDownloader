// SearchView组件
import { Bdg, Btn, Crd, Chp, IcBtn, Seg, Spn, TxFld } from '../ui/components'
import { Bx, Grd, HStk, Hdg, Icn, Img, Txt, VStk } from '../ui/primitives'
import { gtarturl } from '../utils/format'
import { gtrslbl } from '../app/helpers'
import type { SearchFilter } from '../app/types'
import type { AppStore } from '../app/useAppStore'

const FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '曲目', value: 'songs' },
  { label: '专辑', value: 'albums' },
  { label: '歌手', value: 'artists' },
  { label: 'MV', value: 'music-videos' },
]

// SearchView组件渲染入口
export function SrchVw({ store }: { store: AppStore }) {
  const {
    filteredSearchResults, hdlrcck, isPlaying, opndwcf, pltrkpr, playingTrack, recommendations, searchError, searchFilter, searchKeyword, searchLoading, searchPerformed, searchRecommendations, searchResults, setSearchFilter, setSearchKeyword, trgsrch,
  } = store

  return (
    <VStk gap="normal">
      {/* Search Block */}
      <Crd>
        <VStk gap="compact">
          <Hdg level={3}>搜索曲库</Hdg>
          <HStk gap="compact" style={{ marginTop: '8px' }}>
            <TxFld
              style={{ flex: 1 }}
              placeholder="输入关键词或曲目分享链接..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void trgsrch()
                }
              }}
              prefix={<Icn name="search" size={16} />}
            />
            <Btn
              onClick={() => void trgsrch()}
              disabled={searchLoading}
              leadingIcon={searchLoading ? <Spn size={14} /> : <Icn name="search" size={14} />}
            >
              {searchLoading ? '检索中...' : '搜索'}
            </Btn>
          </HStk>

          {/* Recommendation pill Tags */}
          <div className="search-chips">
            <Txt tone="secondary" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>常用搜索：</Txt>
            {(recommendations.length > 0 ? recommendations : searchRecommendations).map((rec) => (
              <Chp key={rec} onClick={() => hdlrcck(rec)}>
                {rec}
              </Chp>
            ))}
          </div>
        </VStk>
      </Crd>

      {/* Filter Block */}
      <Crd>
        <VStk gap="compact">
          <Hdg level={4}>筛选</Hdg>
          <HStk gap="normal" style={{ flexWrap: 'wrap', marginTop: '4px' }}>
            <Seg
              options={FILTER_OPTIONS}
              value={searchFilter}
              onChange={(val) => setSearchFilter(val as SearchFilter)}
            />
          </HStk>
        </VStk>
      </Crd>

      {/* Search Errors */}
      {searchError && (
        <Bx surface border padding="normal" radius="container" style={{ borderColor: 'var(--system-error)' }}>
          <HStk gap="compact" align="center">
            <Icn name="alert" size={18} style={{ color: 'var(--system-error)' }} />
            <Txt tone="error" style={{ fontSize: '0.9rem' }}>{searchError}</Txt>
          </HStk>
        </Bx>
      )}

      {/* 搜索无结果空状态 */}
      {searchPerformed && !searchLoading && filteredSearchResults.length === 0 && !searchError && (
        <Crd>
          <VStk align="center" gap="normal" style={{ paddingBlock: '24px' }}>
            <Icn name="search" size={24} style={{ color: 'var(--text-secondary)' }} />
            <Txt tone="secondary">
              {searchResults.length > 0 ? '当前筛选下没有结果' : '未找到相关内容，试试其他关键词'}
            </Txt>
            {searchResults.length > 0 && (
              <Btn variant="secondary" size="sm" onClick={() => setSearchFilter('all')}>
                查看全部
              </Btn>
            )}
          </VStk>
        </Crd>
      )}

      {/* Search Results Block */}
      {filteredSearchResults.length > 0 && (
        <VStk gap="compact">
          <Hdg level={4}>结果列表 ({filteredSearchResults.length})</Hdg>
          <Grd minItemWidth="290px" gap="normal">
            {filteredSearchResults.map((item) => {
              const isCurrentPlaying = playingTrack?.id === item.id
              const hasPreview = !!item.attributes.previews?.[0]?.url
              const badgeText = gtrslbl(item.type)
              const secondaryText =
                item.type === 'artists'
                  ? '艺术家'
                  : (item.attributes.artistName || '未知歌手')

              return (
                <Crd key={item.id}>
                  <HStk gap="normal" align="center">
                    {/* Artwork Cover */}
                    <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                      <Img
                        src={gtarturl(item.attributes.artwork?.url, 120)}
                        alt={item.attributes.name}
                        style={{ width: '56px', height: '56px' }}
                      />
                    </div>

                    {/* Details */}
                    <VStk gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight={700} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.92rem' }}>
                        {item.attributes.name}
                      </Txt>
                      <HStk gap="compact" align="center">
                        <Txt tone="secondary" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                          {secondaryText}
                        </Txt>
                        <Bdg tone={item.type === 'music-videos' ? 'info' : item.type === 'artists' ? 'success' : 'default'}>
                          {badgeText}
                        </Bdg>
                      </HStk>
                    </VStk>

                    {/* Buttons */}
                    <HStk gap="compact" align="center">
                      {hasPreview && (
                        <IcBtn
                          variant={isCurrentPlaying && isPlaying ? 'primary' : 'ghost'}
                          size={30}
                          onClick={() => pltrkpr(item)}
                          title="试听"
                        >
                          <Icn name={isCurrentPlaying && isPlaying ? 'pause' : 'play'} size={14} filled={isCurrentPlaying && isPlaying} />
                        </IcBtn>
                      )}
                      <Btn
                        variant="secondary"
                        size="sm"
                        leadingIcon={<Icn name="download" size={13} />}
                        onClick={() => opndwcf(item)}
                      >
                        下载
                      </Btn>
                    </HStk>
                  </HStk>
                </Crd>
              )
            })}
          </Grd>
        </VStk>
      )}
    </VStk>
  )
}
