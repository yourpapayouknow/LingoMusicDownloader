// SearchView组件
import { Badge, Button, Card, Checkbox, Chip, IconButton, Spinner, TextField } from '../ui/components'
import { Box, Grid, HStack, Heading, Icon, Image, Text, VStack } from '../ui/primitives'
import { gtarturl } from '../utils/format'
import { gtrslbl } from '../app/helpers'
import type { AppStore } from '../app/useAppStore'

// SearchView组件渲染入口
export function SearchView({ store }: { store: AppStore }) {
  const {
    filterType, filteredSearchResults, handleFilterChange, handleRecommendationClick, isPlaying, openDownloadConfirm, playTrackPreview, playingTrack, recommendations, searchError, searchKeyword, searchLoading, searchRecommendations, setSearchKeyword, triggerSearch,
  } = store

  return (
    <VStack gap="normal">
      {/* Search Block */}
      <Card>
        <VStack gap="compact">
          <Heading level={3}>搜索曲库</Heading>
          <HStack gap="compact" style={{ marginTop: '8px' }}>
            <TextField
              id="search-input"
              style={{ flex: 1 }}
              placeholder="输入关键词或曲目分享链接..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
              prefix={<Icon name="search" size={16} />}
            />
            <Button
              id="search-btn"
              onClick={triggerSearch}
              disabled={searchLoading}
              leadingIcon={searchLoading ? <Spinner size={14} /> : <Icon name="search" size={14} />}
            >
              {searchLoading ? '检索中...' : '搜索'}
            </Button>
          </HStack>

          {/* Recommendation pill Tags */}
          <HStack gap="compact" style={{ flexWrap: 'wrap', marginTop: '12px' }} align="center">
            <Text tone="secondary" style={{ fontSize: '0.8rem' }}>常用搜索：</Text>
            {(recommendations.length > 0 ? recommendations : searchRecommendations).map((rec) => (
              <Chip key={rec} onClick={() => handleRecommendationClick(rec)}>
                {rec}
              </Chip>
            ))}
          </HStack>
        </VStack>
      </Card>

      {/* Filter Block */}
      <Card>
        <VStack gap="compact">
          <Heading level={4}>筛选</Heading>
          <HStack gap="normal" style={{ flexWrap: 'wrap', marginTop: '4px' }}>
            <Checkbox
              label="全部"
              checked={filterType.all}
              onChange={(e) => handleFilterChange('all', e.target.checked)}
            />
            <Checkbox
              label="曲目"
              checked={filterType.song}
              onChange={(e) => handleFilterChange('song', e.target.checked)}
            />
            <Checkbox
              label="专辑"
              checked={filterType.album}
              onChange={(e) => handleFilterChange('album', e.target.checked)}
            />
            <Checkbox
              label="歌手"
              checked={filterType.artist}
              onChange={(e) => handleFilterChange('artist', e.target.checked)}
            />
            <Checkbox
              label="MV"
              checked={filterType.mv}
              onChange={(e) => handleFilterChange('mv', e.target.checked)}
            />
          </HStack>
        </VStack>
      </Card>

      {/* Search Errors */}
      {searchError && (
        <Box surface border padding="normal" radius="container" style={{ borderColor: 'var(--system-error)' }}>
          <HStack gap="compact" align="center">
            <Icon name="alert" size={18} style={{ color: 'var(--system-error)' }} />
            <Text tone="error" style={{ fontSize: '0.9rem' }}>{searchError}</Text>
          </HStack>
        </Box>
      )}

      {/* Search Results Block */}
      {filteredSearchResults.length > 0 && (
        <VStack gap="compact">
          <Heading level={4}>结果列表 ({filteredSearchResults.length})</Heading>
          <Grid minItemWidth="290px" gap="normal">
            {filteredSearchResults.map((item) => {
              const isCurrentPlaying = playingTrack?.id === item.id
              const hasPreview = !!item.attributes.previews?.[0]?.url
              const badgeText = gtrslbl(item.type)
              const secondaryText =
                item.type === 'artists'
                  ? '艺术家'
                  : (item.attributes.artistName || '未知艺人')

              return (
                <Card key={item.id}>
                  <HStack gap="normal" align="center">
                    {/* Artwork Cover */}
                    <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                      <Image
                        src={gtarturl(item.attributes.artwork?.url, 120)}
                        alt={item.attributes.name}
                        style={{ width: '56px', height: '56px' }}
                      />
                    </div>

                    {/* Details */}
                    <VStack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Text weight={700} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.92rem' }}>
                        {item.attributes.name}
                      </Text>
                      <HStack gap="compact" align="center">
                        <Text tone="secondary" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                          {secondaryText}
                        </Text>
                        <Badge tone={item.type === 'music-videos' ? 'info' : item.type === 'artists' ? 'success' : 'default'}>
                          {badgeText}
                        </Badge>
                      </HStack>
                    </VStack>

                    {/* Buttons */}
                    <HStack gap="compact" align="center">
                      {hasPreview && (
                        <IconButton
                          variant={isCurrentPlaying && isPlaying ? 'primary' : 'ghost'}
                          size={30}
                          onClick={() => playTrackPreview(item)}
                          title="试听"
                        >
                          <Icon name={isCurrentPlaying && isPlaying ? 'pause' : 'play'} size={14} filled={isCurrentPlaying && isPlaying} />
                        </IconButton>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        leadingIcon={<Icon name="download" size={13} />}
                        onClick={() => openDownloadConfirm(item)}
                      >
                        下载
                      </Button>
                    </HStack>
                  </HStack>
                </Card>
              )
            })}
          </Grid>
        </VStack>
      )}
    </VStack>
  )
}
