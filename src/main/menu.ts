import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
  ipcMain,
  ipcRenderer,
} from 'electron';

import * as path from "path";

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder
{
  mainWindow: BrowserWindow;
  
  constructor(mainWindow: BrowserWindow)
  {
      this.mainWindow = mainWindow;
  }
  
  buildMenu(): Menu
  {
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true')
      {
          this.setupDevelopmentEnvironment();
      }
          
      const template = process.platform === 'darwin' ? this.buildDarwinTemplate() : this.buildDefaultTemplate();
      
      const menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);
      
      return menu;
  }
      
  setupDevelopmentEnvironment(): void
  {
      this.mainWindow.webContents.on('context-menu', (_, props) =>
      {
          const { x, y } = props;
          
          Menu.buildFromTemplate([
              {
                  label: 'Inspect element',
                  click: () => {
                      this.mainWindow.webContents.inspectElement(x, y);
                  },
              },
          ]).popup({ window: this.mainWindow });
      });
  }
      
  buildDarwinTemplate(): MenuItemConstructorOptions[]
  {

      const subMenuAbout: DarwinMenuItemConstructorOptions = {
          label: 'Acheron',
          submenu: [
              {
                  label: 'About Acheron',
                  selector: 'orderFrontStandardAboutPanel:',
              },
              { type: 'separator' },
              { label: 'Services', submenu: [] },
              { type: 'separator' },
              {
                  label: 'Hide Acheron',
                  accelerator: 'Command+H',
                  selector: 'hide:',
              },
              {
                  label: 'Hide Others',
                  accelerator: 'Command+Shift+H',
                  selector: 'hideOtherApplications:',
              },
              { label: 'Show All', selector: 'unhideAllApplications:' },
              { type: 'separator' },
              {
                  label: 'Quit',
                  accelerator: 'Command+Q',
                  click: () => {
                      app.quit();
                  },
              },
          ],
      };
      const subMenuFile: DarwinMenuItemConstructorOptions = {
        label: 'File',
          submenu: [
              {
                  label: 'Open Composition...',
                  accelerator: 'Command+O',
                  click: () =>
                  {
                      this.mainWindow.webContents.send("open")
                  }
              },
              {
                  label: "Save Composition As...",
                  accelerator: "Command+S",
                  click: () =>
                  {
                      this.mainWindow.webContents.send("saveAs")
                  }
              }
          ],
      };
      const subMenuEdit: DarwinMenuItemConstructorOptions = {
          label: 'Edit',
          submenu: [
              { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
              { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
              { type: 'separator' },
              { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
              { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
              { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
              {
                  label: 'Select All',
                  accelerator: 'Command+A',
                  selector: 'selectAll:',
              },
          ],
      };
      const subMenuLayer: DarwinMenuItemConstructorOptions = {
        label: "&Layer",
        submenu: [
            {
                label: "Add Layer",
                accelerator: "Command+Shift+N",
                click: () =>
                {
                    this.mainWindow.webContents.send("addLayer");
                }
            }
        ]
      };
      const subMenuViewDev: MenuItemConstructorOptions = {
          label: 'View',
          submenu: [
              {
                  label: 'Reload',
                  accelerator: 'Command+R',
                  click: () => {
                      this.mainWindow.webContents.reload();
                  },
              },
              {
                  label: 'Toggle Full Screen',
                  accelerator: 'Ctrl+Command+F',
                  click: () => {
                      this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
                  },
              },
              {
                  label: 'Toggle Developer Tools',
                  accelerator: 'Alt+Command+I',
                  click: () => {
                      this.mainWindow.webContents.toggleDevTools();
                  },
              },
              {
                  label: 'Toggle Left Column',
                  accelerator: 'Command+L',
                  click: () =>
                  {
                      this.mainWindow.webContents.send("toggleLeftColumn");
                  },
              },
              {
                  label: 'Toggle Inspector',
                  accelerator: 'Command+I',
                  click: () =>
                  {
                      this.mainWindow.webContents.send("toggleInspector");
                  },
              },
              {
                  label: "Toggle Multilayer Mode",
                  accelerator: 'Command+Shift+M',
                  click: () =>
                  {
                      this.mainWindow.webContents.send("toggleMultilayer")
                  }
              },
          ],
      };
      const subMenuViewProd: MenuItemConstructorOptions = {
          label: 'View',
          submenu: [
              {
                  label: 'Toggle Full Screen',
                  accelerator: 'Ctrl+Command+F',
                  click: () => {
                      this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
                  },
              },
              {
                  label: 'Toggle Left Column',
                  accelerator: 'Command+L',
                  click: () =>
                  {
                      this.mainWindow.webContents.send("toggleLeftColumn");
                  },
              },
              {
                  label: 'Toggle Inspector',
                  accelerator: 'Command+I',
                  click: () =>
                  {
                      this.mainWindow.webContents.send("toggleInspector");
                  },
              },
              {
                  label: "Toggle Multilayer Mode",
                  accelerator: 'Command+Shift+M',
                  click: () =>
                  {
                      this.mainWindow.webContents.send("toggleMultilayer")
                  }
              },
          ],
      };
      const subMenuWindow: DarwinMenuItemConstructorOptions = {
          label: 'Window',
          submenu: [
              {
                  label: 'Minimize',
                  accelerator: 'Command+M',
                  selector: 'performMiniaturize:',
              },
              { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
              { type: 'separator' },
              { label: 'Bring All to Front', selector: 'arrangeInFront:' },
          ],
      };
      const subMenuHelp: MenuItemConstructorOptions = {
          label: 'Help',
          submenu: [
            {
                label: "Documentation",
                click()
                {
                    shell.openExternal("https://github.com/whisperdoll/acheron/wiki/Acheron-Documentation");
                }
            },
            {
                label: 'Troubleshooting',
                click() {
                    shell.openExternal('https://github.com/whisperdoll/acheron/blob/main/README.md#troubleshooting');
                },
            },
            {
                label: "Report a Bug",
                click()
                {
                    shell.openExternal("https://github.com/whisperdoll/acheron/issues/new?assignees=&labels=bug&template=1-Bug_report.md");
                }
            },
            {
                label: "Credits",
                click()
                {
                    shell.openExternal("https://github.com/whisperdoll/acheron/blob/main/README.md#credits");
                }
            }
          ],
      };
          
      const subMenuView = subMenuViewDev;
      
      return [subMenuAbout, subMenuFile, subMenuEdit, subMenuLayer, subMenuView, subMenuWindow, subMenuHelp];
  }
          
  buildDefaultTemplate(): MenuItemConstructorOptions[]
  {
      const templateDefault: MenuItemConstructorOptions[] = [
          {
              label: '&File',
              submenu: [
                  {
                      label: '&Open Composition...',
                      accelerator: 'Ctrl+O',
                      click: () =>
                      {
                          this.mainWindow.webContents.send("open")
                      }
                  },
                  {
                      label: "&Save Composition As...",
                      accelerator: "Ctrl+S",
                      click: () =>
                      {
                          this.mainWindow.webContents.send("saveAs")
                      }
                  },
                  {
                      label: '&Close',
                      accelerator: 'Ctrl+W',
                      click: () => {
                          this.mainWindow.close();
                      },
                  },
              ],
          },
          {
              label: "&Layer",
              submenu: [
                  {
                      label: "Add Layer",
                      accelerator: "Ctrl+Shift+N",
                      click: () =>
                      {
                          this.mainWindow.webContents.send("addLayer");
                      }
                  }
              ]
          },
          {
              label: '&View',
              submenu: (
                [
                    {
                        label: '&Reload',
                        accelerator: 'Ctrl+R',
                        click: () => {
                            this.mainWindow.webContents.reload();
                        },
                    },
                    {
                        label: 'Toggle &Developer Tools',
                        accelerator: 'Alt+Ctrl+I',
                        click: () => {
                            this.mainWindow.webContents.toggleDevTools();
                        },
                    },
                    { type: 'separator' },
                    {
                        label: 'Toggle &Full Screen',
                        accelerator: 'F11',
                        click: () =>
                        {
                        this.mainWindow.setFullScreen(
                            !this.mainWindow.isFullScreen()
                            );
                        },
                    },
                    {
                        label: 'Toggle &Left Column',
                        accelerator: 'Ctrl+L',
                        click: () =>
                        {
                            this.mainWindow.webContents.send("toggleLeftColumn");
                        },
                    },
                    {
                        label: 'Toggle &Inspector',
                        accelerator: 'Ctrl+I',
                        click: () =>
                        {
                            this.mainWindow.webContents.send("toggleInspector");
                        },
                    },
                    {
                        label: "Toggle &Multilayer Mode",
                        accelerator: 'Ctrl+M',
                        click: () =>
                        {
                            this.mainWindow.webContents.send("toggleMultilayer")
                        }
                    },
                ]
              ) as MenuItemConstructorOptions[]
          },
          {
              label: 'Help',
              submenu: [
                  {
                      label: "Documentation",
                      click()
                      {
                          shell.openExternal("https://github.com/whisperdoll/acheron/wiki/Acheron-Documentation");
                      }
                  },
                  {
                      label: 'Troubleshooting',
                      click() {
                          shell.openExternal('https://github.com/whisperdoll/acheron/blob/main/README.md#troubleshooting');
                      },
                  },
                  {
                      label: "Report a Bug",
                      click()
                      {
                          shell.openExternal("https://github.com/whisperdoll/acheron/issues/new?assignees=&labels=bug&template=1-Bug_report.md");
                      }
                  },
                  {
                      label: "Credits",
                      click()
                      {
                          shell.openExternal("https://github.com/whisperdoll/acheron/blob/main/README.md#credits");
                      }
                  }
              ],
          },
      ];
                  
      return templateDefault;
  }
}
