# .vue
use vue3 composition , script setup , pinia store , use storeToRefs 来解构store
# pnpm
将需要安装的库写入package.json, 而不是直接进行pnpm add , 你可以使用npm info去查询版本, 在完成全部任务后, 最后尝试进行pnpm install
# 封装
组件功能必须尽可能解耦, 封装为独立的组件, 比起传递参数, 我们更喜欢使用useStore