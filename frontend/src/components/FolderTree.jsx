import { useState } from 'react'

// Expandable tree view previewing where Clario would organize renamed files.
function FolderTree({ tree }) {
  const [openFolders, setOpenFolders] = useState(() =>
    Object.fromEntries((tree.children || []).map((folder) => [folder.name, true]))
  )

  const toggleFolder = (folderName) => {
    setOpenFolders((current) => ({
      ...current,
      [folderName]: !current[folderName],
    }))
  }

  return (
    <div className="folder-tree">
      <p className="tree-root">🗂 {tree.name}</p>
      <ul>
        {tree.children.map((folder) => (
          <li key={folder.name}>
            <button
              type="button"
              className="tree-folder"
              onClick={() => toggleFolder(folder.name)}
              aria-expanded={openFolders[folder.name]}
            >
              {openFolders[folder.name] ? '📂' : '📁'} {folder.name}
            </button>
            <ul className={`tree-files ${openFolders[folder.name] ? 'tree-files-open' : ''}`}>
              {folder.children.map((file) => (
                <li key={file} className="tree-file">
                  📄 {file}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FolderTree
