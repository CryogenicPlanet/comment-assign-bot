/** *
 *
 * If someone else wants to use this bot, please change this file while deploying
 */

import axios from "axios";

export const ORG = "modfy";

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
/**
 * Map Github Username to Discord username
 */
export const engMap: Record<string, { name: string; discordId: string }> = {
  zackradisic: { name: "zack", discordId: "474327739311063061" },
  cryogenicplanet: { name: "rahul", discordId: "179264835618471936" },
  patheticgeek: { name: "geek", discordId: "537348830493016075" },
  yug34: {name: "yug", discordId: "680027620578295819"},
};

export const discordWebhook = async (
  owner: string,
  mentions: string[],
  url: string,
) => {
  if (owner === ORG) {
    const discordIds = mentions.map((mention) => mention.toLowerCase())
      .filter((mention) => mention in engMap)
      .map((mention) => {
        return `<@${engMap[mention].discordId}>`;
      });

    if (discordIds.length > 0) {
      const msg = `You have been assigned this issue ${url} on github ${
        discordIds.join(
          " , ",
        )
      }`;

      await axios.post(DISCORD_WEBHOOK_URL, { content: msg });
    }
  }
};
