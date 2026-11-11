/** The reaction row of the message menu: a few common emoji before the full picker. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥"] as const;

export interface EmojiGroup {
  label: string;
  emoji: string[];
}

const split = (list: string) => list.split(" ");

/** The picker's grid: the emoji friends actually send, grouped; the server takes any emoji. */
export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    label: "Smileys",
    emoji: split(
      "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😍 🥰 😘 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤔 🤨 😐 😑 😶 🙄 😏 😬 😮‍💨 🤥 😌 😔 😪 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👻 👽 🤖",
    ),
  },
  {
    label: "Gestures",
    emoji: split(
      "👍 👎 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 👏 🙌 👐 🤲 🙏 💪 🫡 🫶 🤷 🤦 🙋 🧠 👀 👁️",
    ),
  },
  {
    label: "Hearts and symbols",
    emoji: split(
      "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❤️‍🔥 💯 💢 💥 💫 💦 💨 ✨ ⭐ 🌟 ⚡ 🔥 ❄️ ✅ ❌ ❗ ❓ ‼️ 💤 🎯 🆗 🆒 🚫",
    ),
  },
  {
    label: "Football and sports",
    emoji: split("🏈 🏉 🏀 ⚾ 🥎 🏐 ⚽ 🎾 🏒 🥅 ⛳ 🏆 🥇 🥈 🥉 🏅 🎖️ 🏟️ 📣 📢 🚩 🏁 ⏱️ 🎽 🧢 👟"),
  },
  {
    label: "Celebration",
    emoji: split("🎉 🎊 🥂 🍾 🍻 🍺 🍷 🥃 🎁 🎂 🍰 🎈 🎵 🎶 🎤 🕺 💃 🪩 🚀 🛸 🌈 ☀️ 🌙"),
  },
  {
    label: "Animals",
    emoji: split(
      "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦅 🦆 🦉 🐺 🐗 🐴 🦄 🐝 🦋 🐢 🐍 🐙 🦈 🐬 🐳 🐊 🦖 🦬 🐐",
    ),
  },
  {
    label: "Food",
    emoji: split(
      "🍎 🍌 🍉 🍇 🍓 🍑 🍍 🥑 🌽 🌶️ 🥓 🍔 🍟 🍕 🌭 🌮 🌯 🍗 🍖 🥩 🍤 🍣 🍪 🍩 🍫 🍿 🥜 🍦 ☕ 🥤",
    ),
  },
];
