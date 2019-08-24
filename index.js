const fs = require('fs');
const homedir = require('os').homedir();
const path = require('path');
const readline = require('readline');

const checksum = require('checksum');
const cs = checksum('dshaw');

// Get config file
const config = {
	"source": "",
	"dest": "",
	"ignores": [".DS_Store"]
};

try {
	const configPath = path.join(homedir, 'config.json');
	if (!fs.existsSync(configPath)) {
		fs.writeFileSync(configPath, JSON.stringify(config));
		console.log('Created config file in your home directory. Plese update file paths');
		process.exit(0);
	}
	const json = JSON.parse(fs.readFileSync(configPath), 'utf8');
	Object.assign(config, json);
} catch(e) {
	console.log(`Couldn't read config file`);
	process.exit(1);
}
console.log('Configuration: OK');

// Test if we are able to reach the directories
const hasSource = fs.existsSync(config.source);
const hasDest = fs.existsSync(config.dest);
if (!hasSource || !hasDest) {
	console.log(`Couldn't read directories`);
	if (!hasSource) {
		console.log('Oops, something went wrong with your local folder');
	}
	if (!hasDest) {
		console.log('Destination unreachable, please mount the external drive');
	}
	process.exit(1);
}
console.log('Folders: OK');

function checkFiles(source, dest) {
	return new Promise((resolve, reject) => {
		checksum.file(source, (sourceErr, sourceSum) => {
			checksum.file(dest, (destErr, destSum) => {
				console.log('checking?', dest);
				console.log(sourceSum, destSum);
				if (sourceSum == destSum) {
					resolve();
				} else {
					reject();
				}
			});
		});
	});
}

function createSymlink(source, dest) {
	fs.unlinkSync(source);
	fs.symlinkSync(dest, source);
}

function makeDestPath(dirPath, config) {
	return dirPath.replace(config.source, config.dest);
}

function testCreateDir(dirPath, config) {
	if (!fs.lstatSync(dirPath).isDirectory()) {
		console.log('Not a directory: STOPPING');
		process.exit(1);
	}

	const dest = makeDestPath(dirPath, config);

	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest);
	}
}

function testCreateFile(filePath, config) {
	if (!fs.lstatSync(filePath).isFile()) {
		console.log('Not a file: STOPPING');
		process.exit(1);
	}

	const dest = makeDestPath(filePath, config);

	if (!fs.existsSync(dest)) {
		fs.copyFileSync(filePath, dest);
		checkFiles(filePath, dest)
			.then(() => {
				// console.log('same new', dest);
				if (config.clearHDD) {
					createSymlink(filePath, dest);
				}
			})
			.catch(() => {
				// console.log('noddasame new', dest);
			});
	} else {
		checkFiles(filePath, dest)
			.then(() => {
				// console.log('same exists', dest);
				if (config.clearHDD) {
					createSymlink(filePath, dest);
				}
			})
			.catch(() => {
				// console.log('noddasame exists', dest);
			});
	}
}

function doFile(filePath, config) {
	const stats = fs.lstatSync(filePath);
	if (stats.isDirectory()) {
		testCreateDir(filePath, config);
	} else if (stats.isFile()) {
		testCreateFile(filePath, config);
	} else if (stats.isSymbolicLink()) {
		// Ignore symlinks
	} else {
		// Ignore others
	}
}

function doIt(config) {
	console.log('Backing up photos');
	console.log('Source:', config.source);
	console.log('Destination:', config.dest);
	console.log('Clearing drive space:', config.clearHDD || false);
	fs.readdirSync(config.source).forEach((file) => {
		if (config.ignores.includes(file)) {
			return;
		}
		const pathYear = path.join(config.source, file);
		doFile(pathYear, config);
	
		if (fs.lstatSync(pathYear).isDirectory()) {
			fs.readdirSync(pathYear).forEach((file) => {
				if (config.ignores.includes(file)) {
					return;
				}
				const pathMonth = path.join(pathYear, file);
				doFile(pathMonth, config);
	
				if (fs.lstatSync(pathMonth).isDirectory()) {
					fs.readdirSync(pathMonth).forEach((file) => {
						if (config.ignores.includes(file)) {
							return;
						}
						const pathDay = path.join(pathMonth, file);
						doFile(pathDay, config);
	
						if (fs.lstatSync(pathDay).isDirectory()) {
							fs.readdirSync(pathDay).forEach((file) => {
								if (config.ignores.includes(file)) {
									return;
								}
								const pathClub = path.join(pathDay, file);
								doFile(pathClub, config);
	
								if (fs.lstatSync(pathClub).isDirectory()) {
									fs.readdirSync(pathClub).forEach((file) => {
										if (config.ignores.includes(file)) {
											return;
										}
										const pathType = path.join(pathClub, file);
										doFile(pathType, config);
	
										if (fs.lstatSync(pathType).isDirectory()) {
											fs.readdirSync(pathType).forEach((file) => {
												if (config.ignores.includes(file)) {
													return;
												}
												const pathFile = path.join(pathType, file);
												doFile(pathFile, config);
												// console.log(pathFile);
											});
										}
									});
								}
							});
						}
					});
				}
			});
		}
	});
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

rl.question('Do you want to clear hard-drive space? (y|n) ', (answer) => {
	rl.close();
	if (answer === 'y' || answer === 'Y' || answer.toLowerCase() === 'yes') {
		config.clearHDD = true;
	}
	doIt(config);
});

// TODO:
// if it's checksum its probably wise to delete the file at dest and retry copying
// Create log file
