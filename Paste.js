 contentToUpload,
            expireDate: 'N', // Never expire
            format: format, // Syntax highlighting format (set to 'json')
            name: title, // Title of the paste
            publicity: publicityMap[privacy], // Privacy setting
        });

        console.log('Original Pastebin URL:', pasteUrl);

        // Manipulate the URL: Remove 'https://pastebin.com/' and prepend custom words
        const pasteId = pasteUrl.replace('https://pastebin.com/', '');
        const customUrl = `EF-PRIME-MD_${pasteId}`;

        console.log('Custom URL:', customUrl);

        // Return the custom URL
        return customUrl;
    } catch (error) {
        console.error('Error uploading to Pastebin:', error);
        throw error;
    }
}

module.exports = uploadToPastebin;                // If the input is a base64 string, extract the actual base64 data
                const base64Data = input.split(',')[1];
                contentToUpload = Buffer.from(base64Data, 'base64').toString();
            } else if (input.startsWith('http://') || input.startsWith('https://')) {
                // If it's a URL, treat it as plain text
                contentToUpload = input;
            } else if (fs.existsSync(input)) {
                // If the input is a file path, read the file (assume it's creds.json in this case)
                contentToUpload = fs.readFileSync(input, 'utf8');
            } else {
                // Otherwise, treat it as plain text (code snippet or regular text)
                contentToUpload = input;
            }
        } else {
            throw new Error('Unsupported input type. Please provide text, a file path, or base64 data.');
        }

        // Upload the paste
        const pasteUrl = await client.createPaste({
            code: contentToUpload,
            expireDate: 'N', // Never expire
            format: format, // Syntax highlighting format (set to 'json')
            name: title, // Title of the paste
            publicity: publicityMap[privacy], // Privacy setting
        });

        console.log('Original Pastebin URL:', pasteUrl);

        // Manipulate the URL: Remove 'https://pastebin.com/' and prepend custom words
        const pasteId = pasteUrl.replace('https://pastebin.com/', '');
        const customUrl = `EF-PRIME-MD_${pasteId}`;

        console.log('Custom URL:', customUrl);

        // Return the custom URL
        return customUrl;
    } catch (error) {
        console.error('Error uploading to Pastebin:', error);
        throw error;
    }
}

module.exports = uploadToPastebin;                // If the input is a base64 string, extract the actual base64 data
                const base64Data = input.split(',')[1];
                contentToUpload = Buffer.from(base64Data, 'base64').toString();
            } else if (input.startsWith('http://') || input.startsWith('https://')) {
                // If it's a URL, treat it as plain text
                contentToUpload = input;
            } else if (fs.existsSync(input)) {
                // If the input is a file path, read the file (assume it's creds.json in this case)
                contentToUpload = fs.readFileSync(input, 'utf8');
            } else {
                // Otherwise, treat it as plain text (code snippet or regular text)
                contentToUpload = input;
            }
        } else {
            throw new Error('Unsupported input type. Please provide text, a file path, or base64 data.');
        }

        // Upload the paste
        const pasteUrl = await client.createPaste({
            code: contentToUpload,
            expireDate: 'N', // Never expire
            format: format, // Syntax highlighting format (set to 'json')
            name: title, // Title of the paste
            publicity: publicityMap[privacy], // Privacy setting
        });

        console.log('Original Pastebin URL:', pasteUrl);

        // Manipulate the URL: Remove 'https://pastebin.com/' and prepend custom words
        const pasteId = pasteUrl.replace('https://pastebin.com/', '');
        const customUrl = `EF-PRIME-MD_${pasteId}`;

        console.log('Custom URL:', customUrl);

        // Return the custom URL
        return customUrl;
    } catch (error) {
        console.error('Error uploading to Pastebin:', error);
        throw error;
    }
}

module.exports = uploadToPastebin;            // If the input is a Buffer (file content), convert it to string
            contentToUpload = input.toString();
        } else if (typeof input === 'string') {
            if (input.startsWith('data:')) {
                // If the input is a base64 string, extract the actual base64 data
                const base64Data = input.split(',')[1];
                contentToUpload = Buffer.from(base64Data, 'base64').toString();
            } else if (input.startsWith('http://') || input.startsWith('https://')) {
                // If it's a URL, treat it as plain text
                contentToUpload = input;
            } else if (fs.existsSync(input)) {
                // If the input is a file path, read the file (assume it's creds.json in this case)
                contentToUpload = fs.readFileSync(input, 'utf8');
            } else {
                // Otherwise, treat it as plain text (code snippet or regular text)
                contentToUpload = input;
            }
        } else {
            throw new Error('Unsupported input type. Please provide text, a file path, or base64 data.');
        }

        // Upload the paste
        const pasteUrl = await client.createPaste({
            code: contentToUpload,
            expireDate: 'N', // Never expire
            format: format, // Syntax highlighting format (set to 'json')
            name: title, // Title of the paste
            publicity: publicityMap[privacy], // Privacy setting
        });

        console.log('Original Pastebin URL:', pasteUrl);

        // Manipulate the URL: Remove 'https://pastebin.com/' and prepend custom words
        const pasteId = pasteUrl.replace('https://pastebin.com/', '');
        const customUrl = `EF-PRIME-MD_${pasteId}`;

        console.log('Custom URL:', customUrl);

        // Return the custom URL
        return customUrl;
    } catch (error) {
        console.error('Error uploading to Pastebin:', error);
        throw error;
    }
}

module.exports = uploadToPastebin;            // If the input is a Buffer (file content), convert it to string
            contentToUpload = input.toString();
        } else if (typeof input === 'string') {
            if (input.startsWith('data:')) {
                // If the input is a base64 string, extract the actual base64 data
                const base64Data = input.split(',')[1];
                contentToUpload = Buffer.from(base64Data, 'base64').toString();
            } else if (input.startsWith('http://') || input.startsWith('https://')) {
                // If it's a URL, treat it as plain text
                contentToUpload = input;
            } else if (fs.existsSync(input)) {
                // If the input is a file path, read the file (assume it's creds.json in this case)
                contentToUpload = fs.readFileSync(input, 'utf8');
            } else {
                // Otherwise, treat it as plain text (code snippet or regular text)
                contentToUpload = input;
            }
        } else {
            throw new Error('Unsupported input type. Please provide text, a file path, or base64 data.');
        }

        // Upload the paste
        const pasteUrl = await client.createPaste({
            code: contentToUpload,
            expireDate: 'N', // Never expire
            format: format, // Syntax highlighting format (set to 'json')
            name: title, // Title of the paste
            publicity: publicityMap[privacy], // Privacy setting
        });

        console.log('Original Pastebin URL:', pasteUrl);

        // Manipulate the URL: Remove 'https://pastebin.com/' and prepend custom words
        const pasteId = pasteUrl.replace('https://pastebin.com/', '');
        const customUrl = `EF-PRIME-MD_${pasteId}`;  // Fixed: Added backticks for template literal

        console.log('Custom URL:', customUrl);

        // Return the custom URL
        return customUrl;
    } catch (error) {
        console.error('Error uploading to Pastebin:', error);
        throw error;
    }
}

module.exports = uploadToPastebin;                const base64Data = input.split(',')[1];
                contentToUpload = Buffer.from(base64Data, 'base64').toString();
            } else if (input.startsWith('http://') || input.startsWith('https://')) {
                // If it's a URL, treat it as plain text
                contentToUpload = input;
            } else if (fs.existsSync(input)) {
                // If the input is a file path, read the file (assume it's creds.json in this case)
                contentToUpload = fs.readFileSync(input, 'utf8');
            } else {
                // Otherwise, treat it as plain text (code snippet or regular text)
                contentToUpload = input;
            }
        } else {
            throw new Error('Unsupported input type. Please provide text, a file path, or base64 data.');
        }

        // Upload the paste
        const pasteUrl = await client.createPaste({
            code: contentToUpload,
            expireDate: 'N', // Never expire
            format: format, // Syntax highlighting format (set to 'json')
            name: title, // Title of the paste
            publicity: publicityMap[privacy], // Privacy setting
        });

        console.log('Original Pastebin URL:', pasteUrl);

        // Manipulate the URL: Remove 'https://pastebin.com/' and prepend custom words
        const pasteId = pasteUrl.replace('https://pastebin.com/', '');
        const customUrl = EF-PRIME-MD_${pasteId};

        console.log('Custom URL:', customUrl);

        // Return the custom URL
        return customUrl;
    } catch (error) {
        console.error('Error uploading to Pastebin:', error);
        throw error;
    }
}

module.exports = uploadToPastebin;
