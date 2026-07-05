/**
 * video-skill 注册入口
 * 独立分包，通过 wx.modelContext.createSkill 注册原子接口
 */

var parseVideo = require('./apis/parseVideo');

// 创建 skill 实例，path 需与 app.json 中 agent.skills[].path 一致
var skill = wx.modelContext.createSkill('skills/video-skill');

// 注册原子接口，name 需与 mcp.json 中声明的一致
skill.registerAPI('parseVideo', parseVideo);

console.log('[video-skill] parseVideo API registered');
