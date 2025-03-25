import dotenv from "dotenv";
import { ethers } from "ethers";
import fetch from "node-fetch";
import https from "https";
import cfonts from "cfonts";
import chalk from "chalk";
import promptSync from "prompt-sync";
import readline from 'readline';

dotenv.config();
const prompt = promptSync();
const httpsAgent = new https.Agent({ secureProtocol: 'TLSv1_2_method' });
const APi_TOTAL_POINT = process.env.API_TOTAL_POINT || "https://api.tea-fi.com/points";

const shortenHash = (hash) => {
  if (!hash || hash.length < 15) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-4)}`;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createSpinner = (text) => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let interval;

  return {
    start: () => {
      interval = setInterval(() => {
        process.stdout.write(`\r${frames[i]} ${text}`);
        i = (i + 1) % frames.length;
      }, 100);
    },
    stop: () => {
      clearInterval(interval);
      process.stdout.write('\r\x1b[K');
    }
  };
};

const askQuestion = (query, timeout = 15000) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });

    setTimeout(() => {
      rl.close();
      resolve(null);
    }, timeout);
  });
};

const monitorTransaction = async (provider, txHash, totalTimeoutMs, startTime = Date.now()) => {
  const spinner = createSpinner(chalk.yellow("Monitoring transaksi blockchain..."));
  try {
    spinner.start();
    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed > totalTimeoutMs) throw new Error("Timeout");

      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt && receipt.blockNumber) return receipt;

      await delay(10000);
    }
  } finally {
    spinner.stop();
  }
};

const separator = () => console.log(chalk.gray("\n=========================================================================="));
const separators = () => console.log(chalk.bold.blue("==================================================================="));
const pemisah = () => console.log(chalk.yellow("==================================================================="));

const formatApiResponse = (response) => {
  try {
    const result = JSON.parse(response);
    const status = result.pointsAmount && result.id ? "berhasil" : "gagal";
    return `ID: ${result.id}, Points: ${result.pointsAmount}, Status: ${status}`;
  } catch (error) {
    return "Invalid response format";
  }
};

const getTotalPoint = async (walletAddress) => {
  const spinner = createSpinner(chalk.yellow("Mengambil total point..."));
  try {
    spinner.start();
    const url = `${APi_TOTAL_POINT}/${walletAddress}`;
    const getHeaders = {
      "Accept": "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0",
      "Origin": "https://app.tea-fi.com",
      "Referer": "https://app.tea-fi.com/",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
    };

    const response = await fetch(url, { headers: getHeaders, agent: httpsAgent });
    const data = await response.json();
    spinner.stop();

    if (response.ok) {
      const tPoints = Number(data.pointsAmount).toLocaleString("en-US");
      console.log(chalk.white("🧊 Total Sugar/Point Saat ini: ") + chalk.greenBright(tPoints));
    } else {
      console.log(chalk.red(`[X] Gagal: ${JSON.stringify(data)}`));
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red("\n[X] Error:", error.message));
  }
};

const displayGasInfo = async (provider) => {
  const spinner = createSpinner(chalk.yellow("Menghitung gas fee..."));
  try {
    spinner.start();
    const feeData = await provider.getFeeData();
    let gasPrice = feeData.gasPrice;

    if (!gasPrice) {
      console.log(chalk.red("Gas price tidak tersedia."));
      return;
    }

    const gasPriceGwei = ethers.formatUnits(gasPrice, "gwei");
    const gasLimit = 60000n;
    const estimatedFee = gasPrice * gasLimit;
    const estimatedFeeEther = ethers.formatUnits(estimatedFee, "ether");

    const gasPriceLow = (gasPrice * 85n) / 100n;
    const gasPriceLowGwei = ethers.formatUnits(gasPriceLow, "gwei");
    const estimatedFeeLow = gasPriceLow * gasLimit;
    const estimatedFeeLowEther = ethers.formatUnits(estimatedFeeLow, "ether");

    const gasPriceX2 = gasPrice * 2n;
    const gasPriceX5 = gasPrice * 5n;
    const gasPriceX2Gwei = ethers.formatUnits(gasPriceX2, "gwei");
    const gasPriceX5Gwei = ethers.formatUnits(gasPriceX5, "gwei");
    const estimatedFeeX2 = gasPriceX2 * gasLimit;
    const estimatedFeeX5 = gasPriceX5 * gasLimit;
    const estimatedFeeX2Ether = ethers.formatUnits(estimatedFeeX2, "ether");
    const estimatedFeeX5Ether = ethers.formatUnits(estimatedFeeX5, "ether");

    spinner.stop();
    console.log(chalk.yellow("===================== Informasi Gas Fee saat ini =================="));
    console.log(`⛽ Gas Rendah   : ${chalk.bold.redBright(Number(gasPriceLowGwei).toFixed(3).padEnd(10))} Gwei | Estimasi Fee: ${chalk.bold.redBright(Number(estimatedFeeLowEther).toFixed(6).padEnd(12))} POL`);
    console.log(`⛽ Gas Normal   : ${chalk.bold.redBright(Number(gasPriceGwei).toFixed(3).padEnd(10))} Gwei | Estimasi Fee: ${chalk.bold.redBright(Number(estimatedFeeEther).toFixed(6).padEnd(12))} POL`);
    console.log(`⛽ Gas Fee x2   : ${chalk.bold.redBright(Number(gasPriceX2Gwei).toFixed(3).padEnd(10))} Gwei | Estimasi Fee: ${chalk.bold.redBright(Number(estimatedFeeX2Ether).toFixed(6).padEnd(12))} POL`);
    console.log(`⛽ Gas Fee x5   : ${chalk.bold.redBright(Number(gasPriceX5Gwei).toFixed(3).padEnd(10))} Gwei | Estimasi Fee: ${chalk.bold.redBright(Number(estimatedFeeX5Ether).toFixed(6).padEnd(12))} POL`);

    pemisah();
  } catch (error) {
    spinner.stop();
    console.error(chalk.red("Gagal mengambil informasi gas fee:", error.message));
  }
};

const waitWithLiveGasUpdate = (totalDelayMs, provider) => {
  return new Promise((resolve) => {
    const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let spinnerIndex = 0;
    let liveGasInfo = chalk.bold.blueBright("⛽ Live Gas Price: Loading...");
    const startTime = Date.now();

    const updateGasPrice = async () => {
      try {
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice;
        liveGasInfo = chalk.bold.blueBright(`⛽ Live Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} Gwei`);
      } catch (error) {
        liveGasInfo = chalk.bold.red(`Error: ${error.message}`);
      }
    };

    updateGasPrice();
    const gasInterval = setInterval(updateGasPrice, 1000);

    const spinnerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= totalDelayMs) {
        clearInterval(spinnerInterval);
        clearInterval(gasInterval);
        process.stdout.write("\r\x1b[K");
        resolve();
        return;
      }
      const remainingMs = totalDelayMs - elapsed;
      const remainingSecTotal = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(remainingSecTotal / 60);
      const seconds = remainingSecTotal % 60;
      const countdownText = `${minutes} menit ${seconds} detik`;
      const spinnerFrame = spinnerFrames[spinnerIndex];
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
      process.stdout.write(`\r${spinnerFrame} ${liveGasInfo} | ${chalk.bold.whiteBright("Waktu tersisa:")} ${chalk.bold.yellowBright(countdownText)}  `);
    }, 100);
  });
};

async function main() {
  try {
    cfonts.say("NT Exhaust", {
      font: "block",
      align: "center",
      colors: ["cyan", "magenta"],
      background: "transparent",
      letterSpacing: 0,
      lineHeight: 0,
      space: true,
      maxLength: "30",
    });
    console.log(chalk.magenta("=== Telegram Channel : NT Exhaust ( @NTExhaust ) ===\n".padStart((process.stdout.columns + 38) / 2)));

    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL;
    const API_URL = process.env.API_URL;

    if (!privateKey || !rpcUrl || !API_URL) {
      throw new Error("PRIVATE_KEY, RPC_URL, atau API_URL tidak ditemukan di file .env.");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const balanceSpinner = createSpinner(chalk.yellow("Mengambil saldo..."));
    balanceSpinner.start();
    const maticBalance = await provider.getBalance(wallet.address);
    balanceSpinner.stop();

    console.log(chalk.bold.blue("========================= Informasi Account ======================="));
    console.log(`🔥 Alamat Wallet Anda: ${chalk.bold.cyanBright(wallet.address)}`);
    console.log(`💸 Saldo Wallet (POL): ${chalk.bold.greenBright(ethers.formatUnits(maticBalance, "ether"))}\n`);

    await getTotalPoint(wallet.address);

    const tpolAddress = "0x1Cd0cd01c8C902AdAb3430ae04b9ea32CB309CF1";
    const wpolAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";

    const tpolAbi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function wrap(uint256 amount, address recipient)",
      "function unwrap(uint256 amount, address recipient)",
      "function paused() view returns (bool)",
      "error InsufficientBalance()",
      "error ContractPaused()",
      "error MinimumAmountNotMet()"
    ];

    const wpolAbi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function approve(address guy, uint256 wad) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)"
    ];

    const tpolContract = new ethers.Contract(tpolAddress, tpolAbi, wallet);
    const wpolContract = new ethers.Contract(wpolAddress, wpolAbi, wallet);

    const balanceSpinner2 = createSpinner(chalk.yellow("Mengambil saldo token..."));
    balanceSpinner2.start();
    const wpolBalance = await wpolContract.balanceOf(wallet.address);
    const tpolBalance = await tpolContract.balanceOf(wallet.address);
    balanceSpinner2.stop();

    console.log(`💲 Saldo WPOL: ${chalk.bold.greenBright(ethers.formatUnits(wpolBalance, "ether"))}`);
    console.log(`💲 Saldo TPOL: ${chalk.bold.greenBright(ethers.formatUnits(tpolBalance, "ether"))}`);
    separators();

    await displayGasInfo(provider);

    const swapCount = parseInt(prompt("Berapa kali Anda ingin melakukan Swap? : "), 10);
    console.log("\nPilih opsi gas fee yang akan digunakan untuk transaksi:");
    console.log("1. Gas Normal     (Mengikuti gas fee saat ini)");
    console.log("2. Gas Fee Rendah (Menggunakan 85% dari gas fee saat ini)");
    console.log("3. Gas Fee x2     (Gas Fee Normal dikali 2)");
    console.log("4. Gas Fee x5     (Gas Fee Normal dikali 5)\n");
    const gasOption = prompt("Masukkan pilihan (1 / 2 / 3 / 4): ");

    let multiplier;
    if (gasOption === "1") multiplier = 1;
    else if (gasOption === "2") multiplier = 0.85;
    else if (gasOption === "3") multiplier = 2;
    else if (gasOption === "4") multiplier = 5;
    else multiplier = 1;

    console.log(chalk.yellow(`Opsi gas fee yang dipilih: ${
      multiplier === 1 ? "Normal" :
      multiplier === 0.85 ? "Rendah (85%)" :
      multiplier === 2 ? "x2" : "x5"
    }`));
    separator();

    let successfulSwaps = 0;
    for (let i = 1; i <= swapCount; i++) {
      console.log(`\n🔄 Transaksi ke-${i} dari ${swapCount}`);
      separator();

      let retry = true;
      let retryCount = 0;
      while (retry && retryCount < 3) {
        let txResponse, chosenGasPrice;

        try {
          const feeData = await provider.getFeeData();
          const networkGasPrice = feeData.gasPrice;
          const minTip = feeData.maxPriorityFeePerGas;

          chosenGasPrice = multiplier === 0.85
            ? (networkGasPrice * 85n) / 100n
            : networkGasPrice * BigInt(multiplier);

          if(chosenGasPrice < minTip) {
            console.log(chalk.yellowBright(`⚠️  Menyesuaikan gas price ke tip minimum jaringan: ${ethers.formatUnits(minTip, "gwei")} Gwei`));
            chosenGasPrice = minTip;
          }

          const randomAmount = (Math.random() * (0.01 - 0.001) + 0.001).toFixed(5);
          const amountToSwap = ethers.parseUnits(randomAmount, "ether");
          console.log(`💰 Mengirim ${randomAmount} untuk di Swap dengan Gas price ${chalk.bold.redBright(ethers.formatUnits(chosenGasPrice, "gwei"))} Gwei...\n`);

          const contractStatusSpinner = createSpinner(chalk.yellow("Memeriksa status kontrak..."));
          contractStatusSpinner.start();
          const isPaused = await tpolContract.paused();
          contractStatusSpinner.stop();
          if(isPaused) throw new Error("Kontrak dalam keadaan paused!");

          if (i % 2 !== 0) {
            console.log(chalk.bold.magentaBright("🚀 Transaksi: WRAP (WPOL ➯  TPOL)\n"));

            const currentWpolBalance = await wpolContract.balanceOf(wallet.address);
            if(currentWpolBalance < amountToSwap) {
              throw new Error(`Saldo WPOL tidak cukup! Dibutuhkan: ${ethers.formatUnits(amountToSwap, "ether")}, Tersedia: ${ethers.formatUnits(currentWpolBalance, "ether")}`);
            }

            const allowance = await wpolContract.allowance(wallet.address, tpolAddress);
            if (allowance < amountToSwap) {
              if (allowance > 0n) {
                const resetSpinner = createSpinner(chalk.yellow("Mereset allowance..."));
                resetSpinner.start();
                const resetTx = await wpolContract.approve(tpolAddress, 0n, { gasPrice: chosenGasPrice });
                await resetTx.wait();
                resetSpinner.stop();
              }
              const approveSpinner = createSpinner(chalk.yellow("Menyetujui transaksi (approval)..."));
              approveSpinner.start();
              const approveTx = await wpolContract.approve(tpolAddress, amountToSwap, { gasPrice: chosenGasPrice });
              await approveTx.wait();
              approveSpinner.stop();
            }

            const wrapSpinner = createSpinner(chalk.yellow("Memproses transaksi WRAP..."));
            wrapSpinner.start();
            txResponse = await tpolContract.wrap(amountToSwap, wallet.address, {
              gasPrice: chosenGasPrice,
              gasLimit: 100000
            });
            wrapSpinner.stop();
          } else {
            console.log(chalk.bold.magentaBright("🚀 Transaksi: UNWRAP (TPOL ➯  WPOL)\n"));
            const unwrapSpinner = createSpinner(chalk.yellow("Memproses transaksi UNWRAP..."));
            unwrapSpinner.start();
            txResponse = await tpolContract.unwrap(amountToSwap, wallet.address, {
              gasPrice: chosenGasPrice,
              gasLimit: 100000
            });
            unwrapSpinner.stop();
          }

          // Perpendek hash transaksi untuk tampilan
          const shortHash = shortenHash(txResponse.hash);
          console.log(`✅ Transaksi terkirim: ${chalk.cyanBright(shortHash)}\n`);
          const receipt = await monitorTransaction(provider, txResponse.hash, 600000);
          console.log(`✅ Transaksi dikonfirmasi: ${chalk.cyanBright(shortenHash(txResponse.hash))}`);

          const gasFee = BigInt(receipt.gasUsed) * chosenGasPrice;
          console.log(`💸 Biaya gas yang dikeluarkan: ${chalk.bold.redBright(ethers.formatUnits(gasFee, "ether"))} POL`);

          const payload = {
            blockchainId: 137,
            type: i % 2 !== 0 ? 2 : 3,
            walletAddress: wallet.address,
            hash: txResponse.hash,
            fromTokenAddress: i % 2 !== 0 ? wpolAddress : tpolAddress,
            toTokenAddress: i % 2 !== 0 ? tpolAddress : wpolAddress,
            fromTokenSymbol: i % 2 !== 0 ? "WPOL" : "TPOL",
            toTokenSymbol: i % 2 !== 0 ? "TPOL" : "WPOL",
            fromAmount: randomAmount,
            toAmount: randomAmount,
            gasFeeTokenAddress: "0x0000000000000000000000000000000000000000",
            gasFeeTokenSymbol: "POL",
            gasFeeAmount: gasFee.toString()
          };

          const responseAPI = await fetch(API_URL, {
            method: "POST",
            headers: {
              "Accept": "application/json, text/plain, */*",
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0",
              "Origin": "https://app.tea-fi.com",
              "Referer": "https://app.tea-fi.com/",
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-site",
            },
            body: JSON.stringify(payload),
            agent: httpsAgent
          });

          if (!responseAPI.ok) throw new Error(`Gagal API: ${await responseAPI.text()}`);

          const result = await responseAPI.json();
          console.log(`✅ Respons API: ${chalk.green(formatApiResponse(JSON.stringify(result)))}`);

          successfulSwaps++;
          retry = false;

        } catch (error) {
          if (error.code === 'UNKNOWN_ERROR') {
            console.log(chalk.red(`❌ Error jaringan: ${error.shortMessage}`));
            retryCount++;
            await delay(3000);
          } else {
            console.error(chalk.red("❌ Error:", error.message));
            retry = false;
          }
        }
      }

      if (i === swapCount) {
        separator(`\n`);
        console.log(chalk.green(`✅ Semua transaksi selesai! Berhasil: ${successfulSwaps}/${swapCount}`));
        await getTotalPoint(wallet.address);
      } else {
        const delayTime = Math.random() * (240000 - 100000) + 100000;
        const minutes = Math.floor(delayTime / 60000);
        const seconds = Math.floor((delayTime % 60000) / 1000);
        console.log(`🕐 Menunggu ${minutes} menit ${seconds} detik sebelum transaksi berikutnya...`);
        separator();
        await waitWithLiveGasUpdate(delayTime, provider);
      }
    }
  } catch (error) {
    console.error(chalk.red("❌ Error utama:", error.message));
  }
}

main();
