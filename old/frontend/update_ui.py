import re

app_path = "f:/College/Activ_CodeProjects/PycharmProjects/LingoMusicDownloader/frontend/src/App.tsx"

with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Recommendations mapping
content = content.replace(
    "{searchRecommendations.map((rec) => (",
    "{(recommendations.length > 0 ? recommendations : searchRecommendations).map((rec) => ("
)

# 2. History block injection
old_block = """                  </VStack>
                )}
              </VStack>
            </VStack>
          )}

          {/* TAB 3: SETTINGS VIEW */}"""

new_block = """                  </VStack>
                )}
              </VStack>

              {/* DOWNLOAD HISTORY */}
              <VStack gap="compact" style={{ marginTop: '16px' }}>
                <HStack justify="space-between" align="center">
                  <Heading level={3}>历史已下载 ({downloadHistory.length})</Heading>
                  <Button variant="ghost" size="sm" onClick={() => getHistoryApi().then(res => setDownloadHistory(res))}>刷新</Button>
                </HStack>
                {downloadHistory.length === 0 ? (
                  <Text tone="secondary" style={{ fontSize: '0.85rem' }}>暂无历史下载记录</Text>
                ) : (
                  <Grid minItemWidth="290px" gap="normal">
                    {downloadHistory.map(item => (
                      <Card key={item.id}>
                        <HStack gap="normal" align="center">
                          <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                            <Image src={item.artwork_url || logoImage} style={{ width: '48px', height: '48px' }} />
                          </div>
                          <VStack gap={2} style={{ flex: 1, minWidth: 0 }}>
                            <Text weight={700} style={{ fontSize: '0.94rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</Text>
                            <HStack gap="compact" align="center">
                              <Text tone="secondary" style={{ fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{item.artist_name}</Text>
                              <Badge tone="success">{item.codec}</Badge>
                            </HStack>
                          </VStack>
                          <HStack gap="compact" align="center">
                            <IconButton variant="secondary" size={32} onClick={() => {
                              if (audioRef.current) {
                                audioRef.current.pause();
                                audioRef.current.src = getLocalPlayUrl(item.track_id);
                                audioRef.current.load();
                                audioRef.current.play().then(() => setIsPlaying(true));
                              }
                              // Mock tracking for playback display
                              const fakeTrack: any = {
                                id: item.track_id,
                                attributes: { name: item.name, artistName: item.artist_name, artwork: { url: item.artwork_url } }
                              };
                              setPlayingTrack(fakeTrack);
                            }} title="本地播放">
                              <Icon name="play" size={14} />
                            </IconButton>
                            <IconButton variant="ghost" size={32} onClick={() => {
                              if(window.confirm('确定要删除此历史记录吗？将同时尝试删除本地文件。')) {
                                deleteHistoryApi(item.track_id, true).then(() => {
                                  getHistoryApi().then(res => setDownloadHistory(res));
                                }).catch(console.error);
                              }
                            }} title="删除记录">
                              <Icon name="trash" size={14} style={{ color: 'var(--system-error)' }} />
                            </IconButton>
                          </HStack>
                        </HStack>
                      </Card>
                    ))}
                  </Grid>
                )}
              </VStack>

            </VStack>
          )}

          {/* TAB 3: SETTINGS VIEW */}"""

if old_block in content:
    content = content.replace(old_block, new_block)
else:
    print("WARNING: Could not find block to replace.")

with open(app_path, "w", encoding="utf-8") as f:
    f.write(content)

print("UI updated.")
