import { Client, Message, TextChannel } from "discord.js";
import { validMessage, restart } from "../utils";
import config from "../../data/config.json";
import fs from "fs";

/**
 * Collects and filters all the messages in a {@code TextChanne}, specified by
 * the input {@code #args[0]} channel ID. This function should be ran in the
 * {@code Guild} that contains the {@code TextChannel}. After all messages are
 * collected, messages are filtered and written to disk.
 * @param args Expected to contain a channel ID to get all messages from. If
 *             not entered, defaults to the message's channel ID
 */
export async function run(
  client: Client,
  message: Message,
  args: string[]
): Promise<void> {
  // Only execute if I called this command
  if (message.author.id !== config.ids.ownerID) return;

  // Grab the TextChannel from args[0] or message.channel.id
  let channelID = message.channel.id;
  if (args[0]) channelID = args[0];
  const channel = client.channels.cache.get(channelID) as TextChannel;
  if (!channel) return;

  // Setup initial variables
  let messages: Message[] = [];
  let lastID: string | undefined;

  // Continue fetching till return
  message.channel.send(
    `Initiating message collection for "${channel.name}" text channel.`
  );
  while (true) {
    // Make the API call
    const fetchedMessages = await channel.messages.fetch({
      limit: 100,
      ...(lastID && { before: lastID }),
    });

    // Save to disk at this point
    if (fetchedMessages.size === 0) {
      // Filter the fetchedMessages by message validity.
      messages.forEach(
        (msg) => (msg.content = msg.content.split("\n").join("").trim())
      );
      const filteredMessages = messages.filter((msg) => validMessage(msg));

      // Get the database JSON object
      const db: Record<string, any> = JSON.parse(
        fs.readFileSync(config.database).toString()
      );

      // If this TextChannel doesn't have an entry in the DB, add it, otherwise
      // fetch it from the DB
      let channelDB: Record<string, any> = {};
      if (!db[channelID]) {
        db[channelID] = channelDB;
      } else {
        channelDB = db[channelID];
      }

      // For each filtered message, add the message's content sorted per user
      filteredMessages.forEach((message) => {
        if (!channelDB[message.author.id]) {
          channelDB[message.author.id] = [message.content];
        } else {
          channelDB[message.author.id].push(message.content);
        }
      });

      // Write the updated DB to disk.
      fs.writeFileSync(config.database, JSON.stringify(db));
      message.channel.send("Jobs done! Restarting bot...");
      restart(client);
      return;
    }

    // Otherwise update parameters to keep fetching
    messages = messages.concat(Array.from(fetchedMessages.values()));
    lastID = fetchedMessages.lastKey();
  }
}
