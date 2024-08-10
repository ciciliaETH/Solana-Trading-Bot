const TelegramBot = require('node-telegram-bot-api');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

// Replace with your bot token
const token = 'Your_Bot_Token';
const bot = new TelegramBot(token, { polling: true });

// Store the user's wallet in an object
const userWallets = {};

// Function to create a new wallet
function createNewWallet() {
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  const privateKey = bs58.encode(keypair.secretKey);
  return { publicKey, privateKey };
}

// Function to connect wallet with private key
function connectWallet(privateKeyBase58) {
  try {
    const privateKey = bs58.decode(privateKeyBase58);
    const keypair = Keypair.fromSecretKey(privateKey);
    const publicKey = keypair.publicKey.toBase58();
    return { publicKey, privateKey: privateKeyBase58 };
  } catch (error) {
    return null;
  }
}

// Function to display the main menu
function showMainMenu(chatId) {
  bot.sendMessage(chatId, 'Welcome to the Solana Trading Bot! Choose an option:', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Wallet', callback_data: 'wallet' }]],
    },
  });
}

// Function to display a list of available wallets
function showWalletOptions(chatId) {
  const wallets = userWallets[chatId] || [];
  const walletButtons = wallets.map((wallet, index) => ({ text: `Wallet ${index + 1}`, callback_data: `wallet_${index}` }));

  const actionButtons = [
    [
      { text: 'Create New Wallet', callback_data: 'create_wallet' },
      { text: 'Import Wallet', callback_data: 'wallet_connect' },
    ],
    [{ text: 'Back to Main Menu', callback_data: 'main_menu' }],
  ];

  bot.sendMessage(chatId, 'Select a wallet:', {
    reply_markup: {
      inline_keyboard: [...[walletButtons], ...actionButtons],
    },
  });
}

// Handle command /start to display the main menu
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  showMainMenu(chatId);
});

// Handle button callback
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;

  // Delete previous message
  bot.deleteMessage(chatId, message.message_id);

  if (callbackQuery.data === 'wallet') {
    showWalletOptions(chatId);
  } else if (callbackQuery.data === 'create_wallet') {
    const wallet = createNewWallet();
    if (!userWallets[chatId]) userWallets[chatId] = [];
    userWallets[chatId].push(wallet);
    showWalletOptions(chatId);
  } else if (callbackQuery.data === 'wallet_connect') {
    bot.sendMessage(chatId, 'Please send your private key to connect your wallet:');
    bot.once('message', (msg) => {
      const privateKeyBase58 = msg.text.trim();
      const wallet = connectWallet(privateKeyBase58);
      if (wallet) {
        if (!userWallets[chatId]) userWallets[chatId] = [];
        userWallets[chatId].push(wallet);
        showWalletOptions(chatId);
      } else {
        bot.sendMessage(chatId, 'Invalid private key. Please try again.').then(() => showWalletOptions(chatId));
      }
    });
  } else if (callbackQuery.data.startsWith('wallet_')) {
    const index = parseInt(callbackQuery.data.split('_')[1], 10);
    const wallet = userWallets[chatId][index];
    bot.sendMessage(chatId, `*Address:* \`${wallet.publicKey}\``, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: 'Show Private Key', callback_data: `show_private_${index}` }], [{ text: 'Delete Wallet', callback_data: `delete_wallet_${index}` }], [{ text: 'Back to Wallet List', callback_data: 'wallet' }]],
      },
    });
  } else if (callbackQuery.data.startsWith('show_private_')) {
    const index = parseInt(callbackQuery.data.split('_')[2], 10);
    const wallet = userWallets[chatId][index];
    bot.sendMessage(chatId, `*Private Key:* \`${wallet.privateKey}\``, { parse_mode: 'Markdown' });
  } else if (callbackQuery.data.startsWith('delete_wallet_')) {
    const index = parseInt(callbackQuery.data.split('_')[2], 10);
    bot.sendMessage(chatId, 'Are you sure you want to delete this wallet? Make sure you have copied the private key. Press "Delete 100%" to confirm.', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Delete 100%', callback_data: `confirm_delete_${index}` }], [{ text: 'Back to Wallet List', callback_data: 'wallet' }]],
      },
    });
  } else if (callbackQuery.data.startsWith('confirm_delete_')) {
    const index = parseInt(callbackQuery.data.split('_')[2], 10);
    userWallets[chatId].splice(index, 1);
    bot.sendMessage(chatId, 'Wallet deleted.').then(() => showWalletOptions(chatId));
  } else if (callbackQuery.data === 'main_menu') {
    showMainMenu(chatId);
  }
});
