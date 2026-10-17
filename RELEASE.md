# AlphaDesk 发版 SOP

> 规则：**一个版本一个 tag**。历史上曾把 1.0.0~1.0.14 的包全塞在 `v1.0.1` 标签下，
> 导致 `releases/download/v1.0.1/AlphaDesk-1.0.14-win.zip` 这种版本号自相矛盾的链接，已废弃该做法。

## 仓库分工

| 仓库 | 作用 |
|---|---|
| `dennicLiu/alphadesk-src`（private） | 源码。**打 tag 即自动构建**（`build-all-platforms`），只构建 Windows |
| `dennicLiu/alphadesk-app`（public） | 分发。用户在**这里**下载 |
| `dennicLiu/alphadesk-docs`（public） | 官网（GitHub Pages） |

## 发版步骤

### 1. 源码仓库打 tag（触发构建）

```bash
cd DouyinLiveRecorder
git tag v1.0.x
git push private v1.0.x
```

CI 只构建 Windows。**Mac 包必须本地打**：

```bash
.venv/bin/python -m PyInstaller build.spec --noconfirm
```

### 2. 整理两个安装包

```bash
# Windows：从 CI 产物打包（保持扁平结构：AlphaDesk/ + start.bat + start.sh）
cd AlphaDesk-windows-x64 && rm -rf AlphaDesk/logs AlphaDesk/data
zip -qr ../AlphaDesk-<版本>-win.zip .

# Mac
cp -r dist/AlphaDesk.app <暂存>/ && zip -qr AlphaDesk-<版本>-mac.zip AlphaDesk.app
```

### 3. 在分发仓库建 release

每个版本上传**四个**资产：

| 资产名 | 用途 |
|---|---|
| `AlphaDesk-<版本>-win.zip` | 版本化存档（写版本说明时链接它） |
| `AlphaDesk-<版本>-mac.zip` | 同上 |
| `AlphaDesk-latest-win.zip` | **稳定别名**（内容同上），官网固定链接指向它 |
| `AlphaDesk-latest-mac.zip` | 同上 |

### 4. 官网只改 version.json

官网下载链接**永远**用稳定别名，版本号由 `version.json` 的 `latest` 自动填充
（页面里所有 `.ver-auto` 元素）。**发版不需要动 HTML**。

### 5. 旧版本归档

```bash
gh release edit v<旧版本> --repo dennicLiu/alphadesk-app \
  --title "【历史归档】<范围>（旧版请勿下载）" --prerelease
```

**不删旧资产**——可能有老用户或历史文档仍在引用。

## 稳定链接（永不变）

```
https://github.com/dennicLiu/alphadesk-app/releases/latest/download/AlphaDesk-latest-win.zip
https://github.com/dennicLiu/alphadesk-app/releases/latest/download/AlphaDesk-latest-mac.zip
```

因为每个 release 都带一份同名的 `AlphaDesk-latest-*.zip` 资产，`releases/latest` 会自动指向最新版本，
官网链接写一次就永久有效。

## 历史遗留

`v1.0.1` 标签下仍挂着 28 个资产（1.0.0 ~ 1.0.14）。已改标题为「历史归档」并标记 prerelease。
**新版本不要再往上追加**。若需要某旧版本的准确链接，从归档里按文件名取。