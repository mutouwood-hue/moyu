// 自定义签名钩子：本环境无代码签名证书，直接跳过签名（保持 exe 不变）。
// electron-builder 在 cscInfo 为 null 且配置了 sign 时会调用本函数，
// 从而避免使用 winCodeSign 工具（其 .dylib 符号链接在无特权沙箱内无法解压）。
module.exports = async function customSign(configuration) {
  // 不执行任何签名操作，返回即可。
  return;
};
