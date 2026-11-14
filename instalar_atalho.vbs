Option Explicit
Dim WshShell, fso, strDir, desktopPath, shortcut
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
desktopPath = WshShell.SpecialFolders("Desktop")
Set shortcut = WshShell.CreateShortcut(desktopPath & "\Mesa de Compras IA.lnk")

If fso.FileExists(strDir & "\Mesa_Compras_IA.exe") Then
    shortcut.TargetPath = strDir & "\Mesa_Compras_IA.exe"
    shortcut.Arguments = ""
Else
    shortcut.TargetPath = "wscript.exe"
    shortcut.Arguments = """" & strDir & "\iniciar_sistema.vbs"""
End If

shortcut.WorkingDirectory = strDir
shortcut.IconLocation = strDir & "\assets\icone_mesa_compras.ico"
shortcut.Description = "Mesa de Compras IA - Inteligencia em Abastecimento Farmaceutico FSConsultoria"
shortcut.Save
WScript.Echo "[OK] Atalho oficial criado em: " & desktopPath & "\Mesa de Compras IA.lnk"
