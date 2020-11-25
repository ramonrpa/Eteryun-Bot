const Command = require('../strucutres/Command')
const queue = require('../utils/Queue')
const ytdl = require('ytdl-core')

class Resume extends Command {
    constructor(client) {
        super(client)
        this.guildOnly = true
        this.category = 'Diversão'
        this.description = 'Despausar a música atual'
        this.clientPermissions = ['CONNECT', 'SPEAK']
    }

    async run(message, args, { prefix }) {
        const channel = message.channel
        const serverQueue = queue.playlist.get(message.guild.id)
        const voiceChannel = message.member.voice.channel
        if (!voiceChannel)
            return this.sendEmbed(channel, 'Você tem que estar em um canal de voz para despausar uma música')

        if (serverQueue) {
            serverQueue.connection.dispatcher.resume()
        } else {
            this.sendEmbed(channel, `Não há nenhuma música para despausar.`)
        }
    }
}

module.exports = Resume