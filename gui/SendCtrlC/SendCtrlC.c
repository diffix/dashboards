#include <stdio.h>

#include <windows.h>
#include <tlhelp32.h>

void SendCtrlCToProcess(DWORD pid)
{
  FreeConsole();

  AttachConsole(pid) &&
    SetConsoleCtrlHandler(NULL, TRUE) && // Ignore the Ctrl-C event in our own process.
    GenerateConsoleCtrlEvent(CTRL_C_EVENT, pid);

  AttachConsole(-1); // Restore original console.
}

void SendCtrlCToProcessChildren(DWORD ppid)
{
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  PROCESSENTRY32 process = { .dwSize = sizeof(PROCESSENTRY32) };

  if (Process32First(snapshot, &process))
  {
    do
    {
      if (process.th32ParentProcessID == ppid)
        SendCtrlCToProcess(process.th32ProcessID);
    }
    while (Process32Next(snapshot, &process));
  }

  CloseHandle(snapshot);
}

// Sends a Ctrl-C console event to a process and to any direct children it has.
int main(int argc, const char* argv[])
{
  if (argc != 2)
  {
    printf("Usage: SendCtrlC <PID>\n");
    return 1;
  }

  DWORD pid = 0;
  if (sscanf_s(argv[1], "%u", &pid) != 1)
  {
    printf("Error: argument is not a process ID!\n");
    return 1;
  }

  SendCtrlCToProcess(pid);
  SendCtrlCToProcessChildren(pid);

  return 0;
}

