Write-Output "1. Compile TypeScript";
tsc;
Write-Output "2. Generate TypeDocs";
typedoc;
Write-Output "3. Compress using UglifyJS";
uglifyjs simplelogger.js -o simplelogger.min.js --config-file uglify.config.json;
Write-Output "Program built successfully.";
Write-Output "";
exit;
