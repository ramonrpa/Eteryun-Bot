const queue = require('../utils/Queue')
const Discord = require('discord.js')
const fs = require('fs')
const path = require('path')

module.exports = async function onraw(event) {
    if (event.t === 'MESSAGE_REACTION_ADD') {

        if (event.d.user_id == this.user.id)
            return
        
        const channel = this.channels.cache.get(event.d.channel_id)    
        if (channel.type == "dm")
            return

        const guild = this.guilds.cache.get(event.d.guild_id)
        const member = guild.members.cache.get(event.d.user_id)   

        if (event.d.emoji.name == '🎉') {
            if (queue.giveaway.has(event.d.message_id)) {
                const giveaway = queue.giveaway.get(event.d.message_id)
                giveaway.participants.push(event.d.user_id)
                queue.giveaway.set(event.d.message_id, giveaway)
            }
        } else if (event.d.emoji.name == '🔒') {
            let forum = null
            queue.forum.forEach(item => {
                if (item.messageClose.id == event.d.message_id && item.channel.id == channel.id)
                    forum = item
            })
            if (forum) {
                if (hasPerm(member, this.config.forum.rolesToMark)) {
                    let logText = 'Canal criado em: '

                    logText += channel.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }).replace(',', ' -') + '\n\n'
                    await channel.messages.cache.map(msg => {
                        if (msg && msg.content && msg.author && !msg.author.bot) {
                            logText += `${msg.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }).replace(',', ' -')}| ${msg.author.username}: ${msg.content}\n`
                        }
                    })

                    logText += `\nCanal excluido em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }).replace(",", " -")}`
                    const logPath = path.join(__dirname, '..', 'logs')

                    if (!fs.existsSync(logPath)) {
                        await fs.mkdirSync(logPath)
                    }

                    await fs.writeFileSync(path.join(logPath, 'log.txt'), logText, (err) => { if (err) throw err })

                    const channelLog = guild.channels.cache.get(this.config.channels.forum.log)

                    channelLog.send(`\`#${channel.name}\` foi fechado por: ${member.user}`, {
                        files: [{
                            attachment: path.join(logPath, 'log.txt'),
                            name: `#${channel.name}_log.txt`
                        }]
                    })

                    await channel.delete()

                    queue.forum.delete(forum.author)

                }
            }
        } else if (this.config.channels.sugestions.make.find(item => item == event.d.channel_id)) {
            const message = await channel.messages.fetch(event.d.message_id)
            const aproves = message.reactions.cache.find(r => r.emoji.name == '✔️')
            const rejects = message.reactions.cache.find(r => r.emoji.name == '❌')
            if (aproves && rejects) {
                const total = aproves.count + rejects.count - 2
                console.log("Coletados " + total + " reações da mensagem de id " + event.d.message_id)
                if (total >= this.config.sugestions.minVote) {
                    let sub = total - (rejects.count - 1)
                    let percentAproves = (sub / total) * 100
                    if (percentAproves >= this.config.sugestions.minPercentagem) {
                        const adminsugestionchannel = guild.channels.cache.get(this.config.channels.sugestions.admin)
                        const embed = new Discord.MessageEmbed()
                            .setColor(this.config.color)
                            .addField('**Sugestão**', message.content)
                            .setFooter(`Enviado por ${message.member.user.tag}`)
                        adminsugestionchannel.send(embed)
                        message.delete([1000])

                        embed.setTitle('Sugestão Aprovada')
                        channel.send(embed)
                    }
                }
            }

        } else if (this.config.channels.forum.open == event.d.channel_id) {
            const message = await channel.messages.fetch(this.config.forum.messageId)
            const userReactions = message.reactions.cache
            const rolesToMark = this.config.forum.rolesToMark
            const categoryId = this.config.forum.category

            try {
                for (const reaction of userReactions.values()) {
                    await reaction.users.remove(member)
                }
            } catch (error) {
                console.log(error)
            }
            await message.react(this.config.forum.emoji)

            if (queue.forum.has(member)) return member.send(new Discord.MessageEmbed()
                .setDescription('Você já tem um forum aberto. Ele deve ser resolvido para que você possa abrir outro!'))

            const permissions = rolesToMark.map(id => ({ type: 'role', allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'], id }))

            const newChannel = await guild.channels.create(`forum-${member.user.username}`, {
                parent: categoryId,
                permissionOverwrites: [
                    { deny: ['VIEW_CHANNEL', 'SEND_MESSAGES'], id: guild.id },
                    { allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'], id: member.user.id },
                    ...permissions
                ]
            })

            let text = ''
            rolesToMark.forEach(id => {
                text += `<@&${id}>\n`
            })
            text += `${member.user}`

            const msg = await newChannel.send(text)
            msg.delete()

            const embed = new Discord.MessageEmbed()
                .setColor(this.config.color)
                .setDescription(`
                Olá **${member.user.username}**, obrigado por entrar em contato. Em breve algum staff irá lhe responder!
                Para facilitar seu atendimento, por favor envie-nos as seguintes informações:\n
                -Nick
                -Descrição detalhada do seu problema
                -Imagens/videos que ajudem a melhor identificar o erro
                `)
                .setFooter(guild.name, this.user.displayAvatarURL())

            const msgEmbed = await newChannel.send(embed)

            queue.forum.set(member, { channel: newChannel, messageClose: msgEmbed, author: member })

            await msgEmbed.react('🔒')

        } else if (this.config.channels.tags.admin == event.d.channel_id) {
            const message = await channel.messages.fetch(event.d.message_id)
            let accept = false
            let match = message.embeds[0].description.match(/Usuário: <(?:[^\d>]+|:[A-Za-z0-9]+:)\w+>/g)[0]
            match = match.replace('Usuário: <@', '').replace('>', '')
            const memberRequest = guild.members.cache.get(match)
            
            let request = queue.requestRole.get(match)

            if (request) {
                if (event.d.emoji.name == '✅')
                    accept = true
                await message.delete()

                if (accept)
                    await memberRequest.roles.add(request.role.roles)

                const tagResponse = this.channels.cache.get(this.config.channels.tags.response)
                const role = guild.roles.cache.get(request.role.id)
                tagResponse.send(new Discord.MessageEmbed()
                    .setDescription(`${event.d.emoji.name} | ${memberRequest} a sua solicitação para o cargo ${role} foi ${accept ? 'aceita' : 'negada'} por ${member.user}`)
                    .setTimestamp())

                queue.requestRole.delete(match)
            }
        } else if (this.config.channels.order.request == event.d.channel_id) {
            const message = await channel.messages.fetch(this.config.orderrequest.messageId)
            const userReactions = message.reactions.cache
            try {
                for (const reaction of userReactions.values()) {
                    await reaction.users.remove(member)
                }
            } catch (error) {
                console.log(error)
            }
            await message.react(this.config.orderrequest.emoji)

            await member.createDM()
            if (queue.cooldown.has(member.user.id))
                return member.send(new Discord.MessageEmbed()
                    .setDescription(`❌ | Você já tem um formulário de pedido aberto, finalize ele antes de iniciar outro!`))
            queue.cooldown.add(member.user.id)
            let orderDone = false
            let orderTarget, paymentMethod, orderDescription
            let orderEmbed = new Discord.MessageEmbed()
            .setTitle("**NOVO PEDIDO**")
            .setColor(this.config.color)
            .setFooter(guild.name, this.user.displayAvatarURL())
            let newOrderEmbed = new Discord.MessageEmbed()
            .setTitle("**ETERYUN PEDIDOS - NOVO PEDIDO**")
            .setColor(this.config.color)
            .setFooter(guild.name, this.user.displayAvatarURL())

            const orderTargetMessage = await member.send(newOrderEmbed.setDescription(`Por favor, selecione a área devida para seu pedido.\n
            💻 - Developer
            🎨 - Designer
            🛠 - Builder`))
            await orderTargetMessage.react('💻')
            await orderTargetMessage.react('🎨')
            await orderTargetMessage.react('⚒')
            await orderTargetMessage.awaitReactions((reaction, user) => (reaction.emoji.name === '💻' || reaction.emoji.name === '🎨' || reaction.emoji.name === '⚒') && user.id === member.user.id, { time: 300000, max: 1 })
                .then(collected => {
                    const emojis = this.config.orderrequest.roles
                    emojis.forEach(async item => {
                        if (collected.first().emoji.name === item.emoji) {
                            orderTarget = item.id
                        }
                    })
                    orderEmbed.setDescription(`**Área:** <@&${orderTarget}>`)
                }).catch(error => {
                    console.log(error)
                    queue.cooldown.delete(member.user.id)
                    member.send(new Discord.MessageEmbed()
                    .setDescription(`❌ | Seu tempo para solicitar fazer um pedido expirou, reaja novamente para refazer seu pedido!`))
                })

            const orderPaymentMessage = await member.send(newOrderEmbed.setDescription(`Por favor, informe o(s) método(s) de pagamento para seu pedido em uma única mensagem.`))
            await orderPaymentMessage.channel.awaitMessages((message) => message.author.id === member.user.id, { time: 300000, max: 1 })
                .then(collected => {
                    paymentMethod = collected.first().content
                    orderEmbed.setDescription(orderEmbed.description += `
                    **Método(s) de Pagamento:** ${paymentMethod}`)
                }).catch(error => {
                    console.log(error)
                    queue.cooldown.delete(member.user.id)
                    member.send(new Discord.MessageEmbed()
                    .setDescription(`❌ | Seu tempo para solicitar fazer um pedido expirou, reaja novamente para refazer seu pedido!`))
                })

            const orderDescriptionMessage = await member.send(newOrderEmbed.setDescription(`Por favor, informe os detalhes do seu pedido em uma única mensagem.`))
            await orderDescriptionMessage.channel.awaitMessages((message) => message.author.id === member.user.id, { time: 300000, max: 1 })
                .then(collected => {
                    orderDescription = collected.first().content
                    orderEmbed.setDescription(orderEmbed.description += `
                    **Descrição do pedido:** ${orderDescription}
                    **Pedido por:** ${member.user}`)
                }).catch(error => {
                    console.log(error)
                    queue.cooldown.delete(member.user.id)
                    member.send(new Discord.MessageEmbed()
                    .setDescription(`❌ | Seu tempo para solicitar fazer um pedido expirou, reaja novamente para refazer seu pedido!`))
                })
                
            let orderChannel = this.channels.cache.get(this.config.channels.order.orders)
            await orderChannel.send(orderEmbed.setTimestamp())
                .then(() => {
                    orderDone = true
                    queue.cooldown.delete(member.user.id)
                })
            const msg = await orderChannel.send(`<@&${orderTarget}>`)
            msg.delete()
            member.send(new Discord.MessageEmbed()
            .setColor(this.config.color)
            .setDescription(`✅ | Seu pedido foi enviado com sucesso, um dos nossos membros verificados entrará em contato com você em breve!`))

            setTimeout(async () => {
                if (orderDone == false) {
                    queue.cooldown.delete(member.user.id)
                    member.send(new Discord.MessageEmbed()
                    .setDescription(`❌ | Seu tempo para solicitar fazer um pedido expirou, reaja novamente para refazer seu pedido!`))
                }
            }, 300000)
        }

        if (this.config.channels.tags.request == event.d.channel_id) {
            const message = await channel.messages.fetch(this.config.tagsrequest.messageId)
            const userReactions = message.reactions.cache.filter(r => r.users.cache.has(event.d.user_id))

            try {
                for (const reaction of userReactions.values()) {
                    await reaction.users.remove(event.d.user_id)
                }
            } catch (erro) {
                console.log(erro)
            }


            const emojis = this.config.tagsrequest.tags
            let isHave = false
            let role = ''

            emojis.forEach(async item => {
                if (event.d.emoji.name == item.emoji) {
                    if (member.roles.cache.find(r => r.id == item.id))
                        isHave = true
                    role = item
                }
                await message.react(item.emoji)
            })

            await member.createDM()
            if (isHave)
                return member.send(new Discord.MessageEmbed()
                    .setDescription(`❌ | Opa, parece que você está solicitando um cargo que já possuí!`))

            if (queue.cooldown.has(member.user.id))
                return member.send(new Discord.MessageEmbed()
                    .setDescription(`❌ | Acabe de fazer a solicitação de um cargo, finalize está outra solicitação`))

            queue.cooldown.add(member.user.id)

            const messageSended = await member.send(new Discord.MessageEmbed()
                .setDescription(`Olá, ${member.user.username}.\n\nNos envie seu portifólio para que o possamos avaliar enquanto ${role.name}.`)
                .setFooter(`Atenciosamente, Equipe do ${guild.name}`)
                .setColor('RANDOM'))

            let messageCollector = messageSended.channel.createMessageCollector((message) => message.author.id === member.user.id, { time: 120000, max: 1 })
            let coleted = false

            messageCollector.on('collect', async p => {
                coleted = true
                queue.cooldown.delete(member.user.id)
                let portfolio = p.content
                let channelAdmin = this.channels.cache.get(this.config.channels.tags.admin)
                let messageAdmin = await channelAdmin.send(new Discord.MessageEmbed()
                    .setTitle(`**NOVA SOLICITAÇÃO DE TAG**`)
                    .setDescription(`A tag ${role.name} foi solicitada por um usuário.\nUsuário: ${member.user}\n\nPortifólio: ${portfolio}`)
                    .setTimestamp())

                await messageAdmin.react('✅').then(async () => {
                    messageAdmin.react('❌')
                })

                queue.requestRole.set(member.user.id, { role: role, message: messageAdmin })
            })
            setTimeout(async () => {
                if (coleted === false) {
                    queue.cooldown.delete(member.user.id)
                }

                messageSended.edit(new Discord.MessageEmbed()
                    .setDescription(`❌ | Opa, parece que o tempo para enviar o portifólio acabou, reaja novamente!`))
            }, 120000)
        }
    }
}

async function hasPerm(member, rolesIDs) {
    rolesIDs.map((id) => {
        if (member.roles.cache.has(id)) {
            return true
        }
    })
    return false
}
