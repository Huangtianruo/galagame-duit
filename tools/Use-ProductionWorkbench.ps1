#Requires -Version 7
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$projectId = 'X57jbwZOjLw'
$appId = '8bD5JlVexgP'
function Invoke-Zion([string[]]$Command) {
    $raw = npx -y zion-mcp@2.8.3 @Command
    if ($LASTEXITCODE -ne 0) { throw 'Zion CLI 调用失败。' }
    $raw | ConvertFrom-Json -Depth 100
}
$context = Invoke-Zion @('project','get-current')
if ($context.projectExId -ne $projectId -or $context.appExId -ne $appId) {
    throw '请先在本目录用 Zion CLI 选择 galagame / Web 应用。'
}
$release = Invoke-Zion @('site','status','--target','PROD')
if (!$release.active.siteUrl) { throw '工作台没有生效的 PROD 部署；未改动入口。' }
$origin = ([string]$release.active.siteUrl).TrimEnd('/')
$uri = [uri]$origin
if ($uri.Scheme -ne 'https' -or $origin -ne $uri.GetLeftPart([UriPartial]::Authority) -or $uri.UserInfo) {
    throw '工作台必须使用 HTTPS 站点根地址。'
}
$routes = @{
    'index.html' = 'id="cpRooms"'
    'profile.html' = 'avatar/profile.js'
    'project-records.html' = 'journal/records.js'
}
foreach ($route in $routes.Keys) {
    $response = Invoke-WebRequest "$origin/$route" -TimeoutSec 20 -MaximumRedirection 0
    if ($response.StatusCode -ne 200 -or !$response.Content.Contains($routes[$route])) {
        throw "正式工作台内容不匹配：$route。未改动入口。"
    }
}
# Do not label a studio-only root as the public native Duit homepage.
Write-Output "已核对正式工作台、个人中心和运行记录：$origin"
if (!$Apply) { return }
$inspect = @(@{name='GET_CLIENT_VARIABLES_INFO';args=@{}}) | ConvertTo-Json -AsArray -Depth 8 -Compress
$reply = Invoke-Zion @('schema','tool-call','--toolCalls',$inspect)
if ($reply.errors -or $reply.error) { throw '读取页面配置失败。' }
$text = [string]$reply.responses[0]
$entry = [regex]::Match($text,'(?ms)^  - variableKey: (\S+)\r?\n    displayName: workbench_origin\r?\n.*?defaultValueSchemaPath:\r?\n((?:      - key: [^\r\n]+\r?\n?)+)')
if (!$entry.Success) { throw '未找到工作台网址的默认值路径。' }
$path = @([regex]::Matches($entry.Groups[2].Value,'- key: (\S+)') | ForEach-Object { @{key=$_.Groups[1].Value} })
$op = @(@{name='CREATE_CONST_BINDING';args=@{schemaPath=$path;constantValue=$origin}}) | ConvertTo-Json -AsArray -Depth 20 -Compress
$update = Invoke-Zion @('schema','tool-call','--toolCalls',$op)
if ($update.errors -or $update.error -or [string]$update.responses[0] -notmatch 'REPLACE') { throw '保存工作台网址失败。' }
$snapshot = Invoke-Zion @('schema','snapshot','--args','{"full":true}')
$key = $entry.Groups[1].Value
$stored = $snapshot.clients.clientById.$appId.configuration.globalVariableTable.$key.defaultValue.valueBinding[0].value
if ($stored -cne $origin) { throw '回读的网址与已验证的正式工作台不一致。' }
Write-Output '工作台网址已写入 Web 草稿；按原生 Web 客户端发布流程重新预览并发布。'
