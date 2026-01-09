const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SentinelVault", function () {
    let vault, token, owner, vendor, agent, other;
    const dailyLimit = ethers.parseUnits("10000", 18);
    const transactionLimit = ethers.parseUnits("1000", 18);

    beforeEach(async function () {
        [owner, vendor, agent, other] = await ethers.getSigners();

        const MockMNEE = await ethers.getContractFactory("MockMNEE");
        token = await MockMNEE.deploy();
        await token.waitForDeployment();

        const SentinelVault = await ethers.getContractFactory("SentinelVault");
        vault = await SentinelVault.deploy(owner.address, await token.getAddress(), dailyLimit, transactionLimit);
        await vault.waitForDeployment();

        await token.approve(await vault.getAddress(), ethers.parseUnits("100000", 18));
        await vault.deposit(ethers.parseUnits("5000", 18));
    });

    describe("Deployment", function () {
        it("should set correct owner", async function () {
            expect(await vault.owner()).to.equal(owner.address);
        });

        it("should set correct token", async function () {
            expect(await vault.token()).to.equal(await token.getAddress());
        });

        it("should set correct limits", async function () {
            expect(await vault.dailyLimit()).to.equal(dailyLimit);
            expect(await vault.transactionLimit()).to.equal(transactionLimit);
        });
    });

    describe("Deposit", function () {
        it("should accept deposits", async function () {
            expect(await vault.getVaultBalance()).to.equal(ethers.parseUnits("5000", 18));
        });
    });

    describe("Trusted Vendors", function () {
        it("should add trusted vendor", async function () {
            await vault.setTrustedVendor(vendor.address, true);
            expect(await vault.trustedVendors(vendor.address)).to.equal(true);
        });

        it("should remove trusted vendor", async function () {
            await vault.setTrustedVendor(vendor.address, true);
            await vault.setTrustedVendor(vendor.address, false);
            expect(await vault.trustedVendors(vendor.address)).to.equal(false);
        });

        it("should reject non-owner", async function () {
            await expect(vault.connect(other).setTrustedVendor(vendor.address, true)).to.be.reverted;
        });
    });

    describe("Payment Request", function () {
        it("should create payment request", async function () {
            const tx = await vault.requestPayment(vendor.address, ethers.parseUnits("100", 18), agent.address);
            await tx.wait();
            const txn = await vault.getTransaction(0);
            expect(txn.vendor).to.equal(vendor.address);
            expect(txn.amount).to.equal(ethers.parseUnits("100", 18));
        });

        it("should reject exceeding transaction limit", async function () {
            await expect(vault.requestPayment(vendor.address, ethers.parseUnits("2000", 18), agent.address)).to.be.revertedWith("Exceeds transaction limit");
        });

        it("should set instant execution for trusted vendor", async function () {
            await vault.setTrustedVendor(vendor.address, true);
            await vault.requestPayment(vendor.address, ethers.parseUnits("100", 18), agent.address);
            const txn = await vault.getTransaction(0);
            expect(txn.executeAfter).to.equal(txn.timestamp);
        });
    });

    describe("Payment Execution", function () {
        it("should execute payment after timelock", async function () {
            await vault.setTrustedVendor(vendor.address, true);
            await vault.requestPayment(vendor.address, ethers.parseUnits("100", 18), agent.address);
            await vault.executePayment(0);
            const txn = await vault.getTransaction(0);
            expect(txn.executed).to.equal(true);
        });

        it("should reject execution before timelock", async function () {
            await vault.requestPayment(vendor.address, ethers.parseUnits("100", 18), agent.address);
            await expect(vault.executePayment(0)).to.be.revertedWith("Time lock active");
        });
    });

    describe("Revoke", function () {
        it("should revoke pending transaction", async function () {
            await vault.requestPayment(vendor.address, ethers.parseUnits("100", 18), agent.address);
            await vault.revokeTransaction(0, "Suspicious activity");
            const txn = await vault.getTransaction(0);
            expect(txn.revoked).to.equal(true);
        });

        it("should reject executing revoked transaction", async function () {
            await vault.setTrustedVendor(vendor.address, true);
            await vault.requestPayment(vendor.address, ethers.parseUnits("100", 18), agent.address);
            await vault.revokeTransaction(0, "Suspicious");
            await expect(vault.executePayment(0)).to.be.revertedWith("Transaction revoked");
        });
    });

    describe("Emergency Withdraw", function () {
        it("should allow owner to withdraw", async function () {
            const before = await token.balanceOf(owner.address);
            await vault.emergencyWithdraw(ethers.parseUnits("1000", 18));
            const after = await token.balanceOf(owner.address);
            expect(after - before).to.equal(ethers.parseUnits("1000", 18));
        });
    });
});