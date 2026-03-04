import { opendir } from 'fs/promises';
import path, {basename, relative} from "path";


/**
 * Array of objects of directory items could be directory with type "D" or file with type of "F"
 */

type DirectoryIdentifierValues = "F" | "D";
type DirectoryIdentifierKeys = "FILE" | "DIR";

const DIRECTORY_IDENTIFIERS : Record<DirectoryIdentifierKeys,DirectoryIdentifierValues> = {
    FILE: "F",
    DIR: "D"
}

interface Directory  {
    path: string;
    type: "F" | "D";
    parent: string;
}

export type DirectoryTree = Directory[];


/** 
*   Walk through a directory recursively getting all dirs and files.
*    @params /dir/path/ in unix/linx
*    @return map child -> parent
*/

export const getDirectoryTree = async (dir : string) : Promise<DirectoryTree> => {

    // directory tree output of this function.
    const dirTree : DirectoryTree = [];

    /**
     * Walk through a directory recursively, 
     * this function uses async iterators to 
     * read the directory contents and process them concurrently.
     * @param dir 
     */
    async function walkDir(dir : string){
        
        const tasks : Promise<void>[] = [];

        const dirHandler = await opendir(dir);

        for await (const dirent of dirHandler){
            const fullPath : string =  path.join(dir, dirent.name);
            const projectRoot = process.cwd();
            const displayDirName = relative(projectRoot, dir);
            // checks if it directory or file append both with approperiate metadata
            if ( dirent.isDirectory() ){

                dirTree.push({path: fullPath, type: DIRECTORY_IDENTIFIERS.DIR, parent: displayDirName})
                tasks.push(walkDir(fullPath));
            } else if (dirent.isFile()) {
                const fileDisplayName = basename(fullPath)
                dirTree.push({path: fileDisplayName, type: DIRECTORY_IDENTIFIERS.FILE, parent: displayDirName})
            }

        }
        await Promise.all(tasks);

           
    }

    // Walk the dir and process the children concurrently
    await walkDir(dir);

    return dirTree
}
