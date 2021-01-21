module.exports = async function onMessage(message) {
  // Get 
  const mentionClient = (message.guild ? message.guild.me.toString() : this.user.toString()) + ' '
  const prefix = message.content.startsWith(mentionClient) ? mentionClient : (this.config.prefix && message.content.startsWith(this.config.prefix)) ? this.config.prefix : null
  
  let channel = this.config.channels.sugestions.make.find(item => item == message.channel.id)
  if (channel && !message.content.startsWith('^') && message.author.id != this.user.id) {
    await message.react('✔️')
    return await message.react('❌')
  }

  if (message.channel.type != "dm") {
    if (!message.member.hasPermission("ADMINISTRATOR") && (message.content.includes('discord.gg/' || 'discordapp.com/invite/' || 'discord.me'))) return message.delete()
  }
  if (!prefix || message.author.bot) return

  const args = message.content.slice(prefix.length).trim().split(/ +/g)
  const commandName = args.shift().toLowerCase()
  const command = this.commands.find((c, i) => i === commandName || c.aliases.includes(commandName))

  if (command) {
    console.log(`${message.author.username} (${message.author.id}) executou o comando: ${command.name}`)
    await command._run(message, args, { prefix })
  }

}
