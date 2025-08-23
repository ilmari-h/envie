import chalk from "chalk";

export function showPublicKeyWarning(publicKeysServerBase64: string[], currentPublicKeyBase64: string) {
  console.warn(chalk.yellow('Local public key does not match the one on the server'));
  console.warn(chalk.yellow('Viewing or updating environments will fail'));
  console.warn(chalk.yellow('On a machine with one of the existing keypairs, run the following command:'));
  console.warn(chalk.yellow(`  envie config keypair add-pubkey ${currentPublicKeyBase64}`));
  console.warn(chalk.yellow('Existing public keys:'));
  console.warn(chalk.yellow(publicKeysServerBase64.join('\n')));
}